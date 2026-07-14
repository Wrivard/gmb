import "server-only";

// Client DataForSEO — Google Maps SERP API, méthode live/advanced
// (~0,002 $ la requête, réponse immédiate : pas de file de tâches à
// gérer pour un scan mensuel). Auth HTTP Basic login:password.

import { GEOGRID_DEPTH } from "./grid";

const ENDPOINT =
  "https://api.dataforseo.com/v3/serp/google/maps/live/advanced";

export function geogridConfigured(): boolean {
  return Boolean(
    process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD,
  );
}

export interface MapsSearchItem {
  /** Rang organique (index parmi les résultats maps, 1-based). */
  rank: number;
  title: string;
  placeId?: string;
  cid?: string;
  lat?: number;
  lng?: number;
}

export interface MapsSearchResult {
  items: MapsSearchItem[];
  /** Coût facturé par DataForSEO pour cette requête (USD). */
  cost: number;
}

interface DataForSeoItem {
  type: string;
  title?: string;
  place_id?: string;
  cid?: string;
  latitude?: number;
  longitude?: number;
}

/**
 * Une recherche Google Maps vue depuis un point géographique.
 * `language` : code court DataForSEO ("fr"/"en").
 */
export async function mapsSearch(input: {
  keyword: string;
  lat: number;
  lng: number;
  language: string;
  depth?: number;
}): Promise<MapsSearchResult> {
  const auth = Buffer.from(
    `${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`,
  ).toString("base64");

  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      {
        keyword: input.keyword,
        // lat,lng,zoom — 14z ≈ l'échelle d'un quartier, le standard des
        // outils de geogrid.
        location_coordinate: `${input.lat},${input.lng},14z`,
        language_code: input.language,
        device: "desktop",
        depth: input.depth ?? GEOGRID_DEPTH,
      },
    ]),
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) {
    throw new Error(`DataForSEO HTTP ${response.status}`);
  }

  const json = await response.json();
  const task = json?.tasks?.[0];
  if (!task || task.status_code !== 20000) {
    throw new Error(
      `DataForSEO task ${task?.status_code ?? "?"}: ${task?.status_message ?? "réponse vide"}`,
    );
  }

  const raw: DataForSeoItem[] = task.result?.[0]?.items ?? [];
  // Type observé en réel le 2026-07-14 : "maps_search" (la doc montre
  // aussi "maps_search_element" — on accepte les deux).
  const items = raw
    .filter(
      (item) =>
        item.type === "maps_search" || item.type === "maps_search_element",
    )
    .map((item, index) => ({
      rank: index + 1,
      title: item.title ?? "",
      placeId: item.place_id ?? undefined,
      cid: item.cid ?? undefined,
      lat: item.latitude ?? undefined,
      lng: item.longitude ?? undefined,
    }));

  return { items, cost: Number(task.cost ?? 0) };
}
