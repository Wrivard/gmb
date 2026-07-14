import "server-only";

// Orchestration d'un scan geogrid : géocoder l'adresse (une fois),
// résoudre l'identité Maps (une fois, mode réel), puis chercher chaque
// mot-clé depuis les 49 points de la grille et repérer le client dans
// les résultats. Mock déterministe tant que DataForSEO n'est pas
// configuré — même UI, données simulées, purgeables.

import type { getDb } from "@/lib/supabase/db";
import type {
  Client,
  GeogridConfig,
  GeogridRankPoint,
} from "@/lib/types/database";
import {
  buildGrid,
  DEFAULT_SPACING_KM,
  GEOGRID_MAX_KEYWORDS,
  GEOGRID_SIZE,
  gridAggregates,
  mockScanRanks,
  normalizeBusinessTitle,
} from "./grid";
import {
  geogridConfigured,
  mapsSearch,
  type MapsSearchItem,
} from "./dataforseo";

type Db = Awaited<ReturnType<typeof getDb>>;

/** Trop d'échecs réseau/API sur une grille = données de mois pourries :
    on n'enregistre pas. */
const MAX_POINT_FAILURES = 8;
const CONCURRENCY = 8;

export interface ScanSummary {
  clientId: string;
  scanned: string[];
  skipped?: string;
  costUsd: number;
  errors: number;
}

async function pool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
  return results;
}

/** Géocodage gratuit (Nominatim/OSM) — une fois par client, mis en
    cache dans clients.geogrid. Usage loyal : 1 req, User-Agent identifié. */
async function geocodeAddress(
  address: string,
): Promise<{ lat: number; lng: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`;
  const response = await fetch(url, {
    headers: { "User-Agent": "kua-locale/1.0 (wrivard@kua.quebec)" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) return null;
  const data = (await response.json()) as Array<{ lat: string; lon: string }>;
  if (!data?.[0]) return null;
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}

/** Le client dans une liste de résultats Maps : place_id > cid > nom. */
function findClientItem(
  items: MapsSearchItem[],
  config: GeogridConfig,
  clientName: string,
): MapsSearchItem | undefined {
  if (config.place_id) {
    const hit = items.find((i) => i.placeId === config.place_id);
    if (hit) return hit;
  }
  if (config.cid) {
    const hit = items.find((i) => i.cid === config.cid);
    if (hit) return hit;
  }
  const target = normalizeBusinessTitle(clientName);
  return items.find((i) => normalizeBusinessTitle(i.title) === target);
}

/** Langue DataForSEO depuis la langue du client ("fr-CA" → "fr"). */
function languageCode(client: Client): string {
  return client.language?.toLowerCase().startsWith("en") ? "en" : "fr";
}

/**
 * Scan complet d'un client (tous ses mots-clés). Persiste la config
 * enrichie (coordonnées, identité Maps) et une ligne geogrid_scans par
 * mot-clé réussi.
 */
export async function runGeogridScan(
  supabase: Db,
  client: Client,
): Promise<ScanSummary> {
  const config: GeogridConfig = { ...(client.geogrid ?? {}) };
  const keywords = (config.keywords ?? [])
    .map((k) => k.trim())
    .filter(Boolean)
    .slice(0, GEOGRID_MAX_KEYWORDS);
  const summary: ScanSummary = {
    clientId: client.id,
    scanned: [],
    costUsd: 0,
    errors: 0,
  };
  if (!keywords.length) {
    return { ...summary, skipped: "aucun mot-clé configuré" };
  }

  const real = geogridConfigured();
  let configDirty = false;

  // 1. Coordonnées du centre — géocodage de l'adresse, une seule fois.
  let lat = config.lat;
  let lng = config.lng;
  if (lat === undefined || lng === undefined) {
    const address =
      client.address ?? client.gbp_profile?.identity?.address ?? null;
    if (!address) {
      return { ...summary, skipped: "aucune adresse à géocoder" };
    }
    const coords = await geocodeAddress(address);
    if (!coords) {
      return { ...summary, skipped: `géocodage échoué (${address})` };
    }
    lat = coords.lat;
    lng = coords.lng;
    config.lat = lat;
    config.lng = lng;
    configDirty = true;
  }

  // 2. Identité Maps (mode réel) — chercher l'entreprise à sa propre
  // adresse et retenir place_id/cid; ses coordonnées Maps raffinent le
  // centre de la grille.
  if (real && !config.place_id && !config.cid) {
    try {
      const found = await mapsSearch({
        keyword: client.name,
        lat,
        lng,
        language: languageCode(client),
      });
      summary.costUsd += found.cost;
      const self = findClientItem(found.items, config, client.name);
      if (self) {
        config.place_id = self.placeId;
        config.cid = self.cid;
        if (self.lat !== undefined && self.lng !== undefined) {
          lat = self.lat;
          lng = self.lng;
          config.lat = lat;
          config.lng = lng;
        }
        configDirty = true;
      }
      // Pas trouvée par son nom : le matching par nom au point par
      // point reste possible — on continue sans identité.
    } catch (error) {
      console.error(`geogrid identité (${client.name}):`, error);
    }
  }

  const spacingKm = config.spacing_km ?? DEFAULT_SPACING_KM;
  const points = buildGrid(lat, lng, GEOGRID_SIZE, spacingKm);

  // 3. Un scan par mot-clé.
  for (const keyword of keywords) {
    let ranks: GeogridRankPoint[];
    let cost = 0;
    let provider: string;

    if (!real) {
      provider = "mock";
      ranks = mockScanRanks(
        `${client.id}:${keyword}`,
        points,
        lat,
        lng,
        spacingKm,
      );
    } else {
      provider = "dataforseo";
      let failures = 0;
      ranks = await pool(points, CONCURRENCY, async (point) => {
        try {
          const result = await mapsSearch({
            keyword,
            lat: point.lat,
            lng: point.lng,
            language: languageCode(client),
          });
          cost += result.cost;
          const hit = findClientItem(result.items, config, client.name);
          return { ...point, rank: hit?.rank ?? null };
        } catch {
          failures++;
          return { ...point, rank: null };
        }
      });
      summary.costUsd += cost;
      if (failures > MAX_POINT_FAILURES) {
        console.error(
          `geogrid ${client.name} « ${keyword} » : ${failures}/${points.length} points en échec — scan non enregistré.`,
        );
        summary.errors++;
        continue;
      }
    }

    const aggregates = gridAggregates(ranks);
    const { error } = await supabase.from("geogrid_scans").insert({
      client_id: client.id,
      keyword,
      provider,
      grid_size: GEOGRID_SIZE,
      spacing_km: spacingKm,
      center_lat: lat,
      center_lng: lng,
      ranks,
      avg_rank: aggregates.avgRank,
      best_rank: aggregates.bestRank,
      found_count: aggregates.foundCount,
      cost_usd: Number(cost.toFixed(4)),
    });
    if (error) throw new Error(error.message);
    summary.scanned.push(keyword);
  }

  // 4. Persister la config enrichie (coordonnées/identité résolues).
  if (configDirty) {
    await supabase
      .from("clients")
      .update({ geogrid: config })
      .eq("id", client.id);
  }

  return summary;
}
