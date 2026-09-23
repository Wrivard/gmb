// Mode d'accès GBP — source unique de vérité.
//
// Il y a eu trois modes à partir du 2026-09-23 : `mock` (fixtures),
// `real` (Google en direct) et `zernio` (Google via Zernio, faute
// d'approbation Google). Le piège : six endroits testaient
// `GBP_MODE === "real"` et auraient rangé `zernio` du côté simulé —
// la découverte aurait marqué les vraies fiches `is_demo`. D'où ce
// helper : on demande « est-ce simulé ? », jamais « est-ce real ? ».

export type GbpMode = "mock" | "real" | "zernio";

export function gbpMode(raw: string | undefined = process.env.GBP_MODE): GbpMode {
  return raw === "real" || raw === "zernio" ? raw : "mock";
}

/** Vrai seulement en `mock` : les données viennent de fixtures. */
export function isSimulatedGbp(raw?: string): boolean {
  return gbpMode(raw) === "mock";
}

/** Un vrai commerce est derrière l'appel — `real` ou `zernio`. */
export function isLiveGbp(raw?: string): boolean {
  return !isSimulatedGbp(raw);
}
