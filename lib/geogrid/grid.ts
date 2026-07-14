// Geogrid — géométrie de la grille, agrégats et matching de nom.
// Fonctions pures, sans "server-only" : consommées par le scan (serveur)
// et la carte (client), testées à part.

import type { GeogridRankPoint } from "@/lib/types/database";

export const GEOGRID_SIZE = 7;
/** ~1,7 km entre les points → la grille 7×7 couvre ~10 km de côté. */
export const DEFAULT_SPACING_KM = 1.7;
/** Garde de coût : 2 mots-clés max par client. */
export const GEOGRID_MAX_KEYWORDS = 2;
/** Au-delà du top 20, « pas trouvé » suffit pour la carte. */
export const GEOGRID_DEPTH = 20;

const KM_PER_DEGREE_LAT = 111.32;

export interface GridPoint {
  lat: number;
  lng: number;
}

/**
 * Grille size×size centrée sur (centerLat, centerLng), ordonnée ligne
 * par ligne (nord → sud, ouest → est) — le point central est au milieu
 * du tableau.
 */
export function buildGrid(
  centerLat: number,
  centerLng: number,
  size = GEOGRID_SIZE,
  spacingKm = DEFAULT_SPACING_KM,
): GridPoint[] {
  const half = Math.floor(size / 2);
  const latStep = spacingKm / KM_PER_DEGREE_LAT;
  const lngStep =
    spacingKm / (KM_PER_DEGREE_LAT * Math.cos((centerLat * Math.PI) / 180));
  const points: GridPoint[] = [];
  for (let row = -half; row <= half; row++) {
    for (let col = -half; col <= half; col++) {
      points.push({
        lat: Number((centerLat - row * latStep).toFixed(6)),
        lng: Number((centerLng + col * lngStep).toFixed(6)),
      });
    }
  }
  return points;
}

export interface GridAggregates {
  avgRank: number | null;
  bestRank: number | null;
  foundCount: number;
}

/** Moyenne/meilleur sur les points où l'entreprise est trouvée. */
export function gridAggregates(ranks: GeogridRankPoint[]): GridAggregates {
  const found = ranks.filter(
    (p): p is GeogridRankPoint & { rank: number } => p.rank !== null,
  );
  if (!found.length) return { avgRank: null, bestRank: null, foundCount: 0 };
  const sum = found.reduce((acc, p) => acc + p.rank, 0);
  return {
    avgRank: Number((sum / found.length).toFixed(1)),
    bestRank: Math.min(...found.map((p) => p.rank)),
    foundCount: found.length,
  };
}

/** Normalise un nom d'entreprise pour le matching (accents, casse,
    ponctuation légère) — « Toitures Bergeron Inc. » ≈ « toitures bergeron inc ». */
export function normalizeBusinessTitle(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/* ── Mock (avant les accès DataForSEO) ────────────────────────────── */

/** Hash déterministe simple (FNV-1a) — même seed, mêmes rangs. */
function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Rangs simulés plausibles : bons au centre (l'adresse), qui se
 * dégradent avec la distance, avec du bruit déterministe et des trous
 * aux coins. Permet de développer/valider l'UI avant les accès API.
 */
export function mockScanRanks(
  seed: string,
  points: GridPoint[],
  centerLat: number,
  centerLng: number,
  spacingKm = DEFAULT_SPACING_KM,
): GeogridRankPoint[] {
  return points.map((point) => {
    const dLatKm = (point.lat - centerLat) * KM_PER_DEGREE_LAT;
    const dLngKm =
      (point.lng - centerLng) *
      KM_PER_DEGREE_LAT *
      Math.cos((centerLat * Math.PI) / 180);
    const distanceKm = Math.sqrt(dLatKm * dLatKm + dLngKm * dLngKm);
    const noise = hash(`${seed}:${point.lat}:${point.lng}`) % 5;
    const rank = Math.round(1 + distanceKm / (spacingKm * 0.7) + noise);
    return { ...point, rank: rank > GEOGRID_DEPTH ? null : rank };
  });
}
