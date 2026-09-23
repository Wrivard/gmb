import "server-only";

import { getDb } from "@/lib/supabase/db";
import { getGbpClient } from "./client";
import { isSimulatedGbp } from "./mode";
import type { GbpLocation } from "./types";
import type { BrandProfile } from "@/lib/types/database";
import { logActivity } from "@/lib/activity";

// Découverte des fiches GBP (specs/02 §C).
//
// Changement du 2026-09-23 : la découverte ne CRÉE plus de projet.
// Une connexion expose toutes les fiches du compte Google — 29 chez
// Küa pour 3 mandats — et les créer toutes en pause noyait la liste
// Projets. L'import est devenu explicite (Réglages → Fiches Google) ;
// la découverte ne fait plus que rafraîchir ce qui est déjà importé et
// signaler ce qui a disparu.

function defaultBrandProfile(location: GbpLocation): BrandProfile {
  const city = location.storefrontAddress?.locality;
  const category = location.categories?.primaryCategory?.displayName;
  return {
    tone: "chaleureux et professionnel",
    vertical: category?.toLowerCase(),
    city,
    signature: `L'équipe ${location.title}`,
    phone: location.phoneNumbers?.primaryPhone,
    a_eviter: ["prix précis"],
  };
}

function formatAddress(location: GbpLocation): string | null {
  const addr = location.storefrontAddress;
  if (!addr) return null;
  const parts = [
    ...(addr.addressLines ?? []),
    [addr.locality, addr.administrativeArea].filter(Boolean).join(", "),
    addr.postalCode,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

/** Snapshot de fiche commun à l'import et au rafraîchissement. */
function locationSnapshot(location: GbpLocation) {
  return {
    address: formatAddress(location),
    phone: location.phoneNumbers?.primaryPhone ?? null,
    website: location.websiteUri ?? null,
    primary_category:
      location.categories?.primaryCategory?.displayName ?? null,
  };
}

export interface DiscoveryResult {
  /** Fiches vues chez Google. */
  discovered: number;
  /** Projets déjà importés dont le snapshot a été mis à jour. */
  refreshed: number;
  disconnected: number;
}

export async function runDiscovery(
  agencyId: string,
  actor: string,
): Promise<DiscoveryResult> {
  const gbp = getGbpClient();
  const supabase = await getDb();
  // En mock, les fiches sortent des fixtures : elles naissent fictives,
  // sinon une base neuve se remplirait de faux commerces indiscernables
  // des vrais.
  const mockDiscovery = isSimulatedGbp();

  const accounts = await gbp.listAccounts();
  const seenLocationIds = new Set<string>();
  let discovered = 0;
  let refreshed = 0;

  for (const account of accounts) {
    const locations = await gbp.listLocations(account.name);
    for (const location of locations) {
      discovered++;
      seenLocationIds.add(location.name);

      const { data: existing } = await supabase
        .from("clients")
        .select("id, status")
        .eq("gbp_location_id", location.name)
        // Une découverte ne rapatrie que les fiches de SON monde : jamais
        // une fiche réelle ne doit venir écraser une fiche de démo.
        .eq("is_demo", mockDiscovery)
        .maybeSingle();

      // Pas encore importée : elle apparaîtra dans Réglages → Fiches
      // Google, pas ici.
      if (!existing) continue;

      // Snapshot rafraîchi; on ne touche pas aux réglages. Un projet
      // archivé (offboardé) reste archivé même si la fiche est toujours
      // accessible côté Google.
      await supabase
        .from("clients")
        .update({
          ...locationSnapshot(location),
          ...(existing.status === "disconnected"
            ? { status: "active" as const }
            : {}),
        })
        .eq("id", existing.id);
      refreshed++;
    }
  }

  // Locations disparues (accès retiré) → disconnected, jamais supprimées.
  // Les archivés sont hors jeu : ne pas les basculer disconnected.
  const { data: allClients } = await supabase
    .from("clients")
    .select("id, gbp_location_id, status, is_demo")
    .eq("agency_id", agencyId)
    // Le bilan « fiche disparue » ne vaut que dans le monde qu'on vient
    // d'interroger. Sans ce filtre, la première découverte RÉELLE
    // basculerait les clients de démo en « déconnecté » : leurs ids de
    // fixtures n'existent évidemment pas chez Google.
    .eq("is_demo", mockDiscovery)
    .not("status", "in", "(disconnected,archived)");

  let disconnected = 0;
  for (const client of allClients ?? []) {
    // Créé à la main, pas encore de fiche liée : rien à « perdre ».
    if (!client.gbp_location_id) continue;
    if (!seenLocationIds.has(client.gbp_location_id)) {
      await supabase
        .from("clients")
        .update({ status: "disconnected" })
        .eq("id", client.id);
      disconnected++;
    }
  }

  await logActivity({
    agencyId,
    actor,
    action: "discovery_completed",
    payload: { discovered, refreshed, disconnected },
  });

  return { discovered, refreshed, disconnected };
}

export interface ImportableLocation {
  /** Resource name du compte Google : `accounts/{id}`. */
  accountId: string;
  /** Resource name de la fiche : `locations/{id}`. */
  locationId: string;
  title: string;
  address: string | null;
  category: string | null;
  website: string | null;
  /** Déjà un projet dans l'app. */
  imported: boolean;
}

/**
 * Toutes les fiches visibles chez Google, marquées « déjà importée » ou
 * non. C'est la matière de l'écran Réglages → Fiches Google, qui a
 * remplacé la liste blanche par variable d'environnement.
 */
export async function listImportableLocations(
  agencyId: string,
): Promise<ImportableLocation[]> {
  const gbp = getGbpClient();
  const supabase = await getDb();
  const mockDiscovery = isSimulatedGbp();

  const { data: clients } = await supabase
    .from("clients")
    .select("gbp_location_id")
    .eq("agency_id", agencyId)
    .eq("is_demo", mockDiscovery);
  const imported = new Set(
    (clients ?? []).map((client) => client.gbp_location_id).filter(Boolean),
  );

  const results: ImportableLocation[] = [];
  for (const account of await gbp.listAccounts()) {
    for (const location of await gbp.listLocations(account.name)) {
      results.push({
        accountId: account.name,
        locationId: location.name,
        title: location.title,
        address: formatAddress(location),
        category:
          location.categories?.primaryCategory?.displayName ?? null,
        website: location.websiteUri ?? null,
        imported: imported.has(location.name),
      });
    }
  }

  // Les fiches à importer d'abord : c'est ce qu'on vient faire ici.
  return results.sort((a, b) =>
    a.imported === b.imported
      ? a.title.localeCompare(b.title, "fr")
      : a.imported
        ? 1
        : -1,
  );
}

export interface ImportResult {
  clientId: string;
  name: string;
}

/**
 * Crée le projet d'une fiche choisie. Il arrive en pause : découvrir
 * une fiche ne veut pas dire qu'un mandat payant existe (specs/02 §C.4),
 * et un projet actif déclenche syncs et publications.
 */
export async function importLocation(
  agencyId: string,
  actor: string,
  accountId: string,
  locationId: string,
): Promise<ImportResult> {
  const gbp = getGbpClient();
  const supabase = await getDb();
  const mockDiscovery = isSimulatedGbp();

  const locations = await gbp.listLocations(accountId);
  const location = locations.find((entry) => entry.name === locationId);
  if (!location) {
    throw new Error(
      `Fiche introuvable chez Google : ${locationId} — resynchronise puis réessaie.`,
    );
  }

  // Deux membres qui cliquent en même temps, ou un import relancé après
  // un aller-retour : on ne veut pas deux projets pour une fiche.
  const { data: existing } = await supabase
    .from("clients")
    .select("id, name")
    .eq("gbp_location_id", locationId)
    .eq("is_demo", mockDiscovery)
    .maybeSingle();
  if (existing) return { clientId: existing.id, name: existing.name };

  const { data: agency } = await supabase
    .from("agencies")
    .select("default_posts_per_month, default_language")
    .eq("id", agencyId)
    .single();

  const { data: created, error } = await supabase
    .from("clients")
    .insert({
      agency_id: agencyId,
      gbp_account_id: accountId,
      gbp_location_id: locationId,
      name: location.title,
      ...locationSnapshot(location),
      posts_per_month: agency?.default_posts_per_month ?? 2,
      language: agency?.default_language ?? "fr-CA",
      brand_profile: defaultBrandProfile(location),
      status: "paused",
      is_demo: mockDiscovery,
    })
    .select("id, name")
    .single();
  if (error) throw new Error(error.message);

  await logActivity({
    agencyId,
    clientId: created.id,
    actor,
    action: "client_imported",
    payload: { location_id: locationId, name: created.name },
  });

  return { clientId: created.id, name: created.name };
}
