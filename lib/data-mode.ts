import "server-only";

import { cookies } from "next/headers";

// Mode de données de la session : « réel » (les vrais mandats, défaut)
// ou « démo » (les clients fictifs du seed, is_demo = true) — pour les
// démonstrations et les tests sans toucher aux vraies données. Le choix
// vit dans un cookie (par navigateur), togglé depuis Réglages.

export type DataMode = "real" | "demo";

export const DATA_MODE_COOKIE = "kua-data-mode";

export async function getDataMode(): Promise<DataMode> {
  const store = await cookies();
  return store.get(DATA_MODE_COOKIE)?.value === "demo" ? "demo" : "real";
}

/** true si la session affiche les clients fictifs. */
export async function isDemoDataMode(): Promise<boolean> {
  return (await getDataMode()) === "demo";
}
