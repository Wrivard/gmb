import "server-only";

import { getDb } from "@/lib/supabase/db";
import { getGbpClient } from "./client";
import { isSimulatedGbp } from "./mode";
import { locationToProfile } from "./profile-import";
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

  // Énumération seule : on ne paie le profil complet que pour les fiches
  // effectivement suivies. Détailler les 29 fiches du compte pour en
  // rafraîchir 3 coûtait 29 appels par exécution.
  const seenLocationIds = new Set<string>();
  for (const account of await gbp.listAccounts()) {
    for (const location of await gbp.listLocations(account.name)) {
      seenLocationIds.add(location.name);
    }
  }

  // Une seule requête : la version précédente interrogeait Supabase une
  // fois par fiche vue.
  const { data: tracked } = await supabase
    .from("clients")
    .select("id, gbp_account_id, gbp_location_id, status")
    .eq("agency_id", agencyId)
    // Une découverte ne touche que les fiches de SON monde : jamais une
    // fiche réelle ne doit venir écraser une fiche de démo.
    .eq("is_demo", mockDiscovery)
    // Un projet archivé (offboardé) reste archivé, même si la fiche est
    // toujours accessible côté Google.
    .neq("status", "archived");

  let refreshed = 0;
  let disconnected = 0;

  for (const client of tracked ?? []) {
    // Créé à la main, pas encore de fiche liée : rien à rafraîchir ni à
    // « perdre ».
    if (!client.gbp_location_id) continue;

    if (!seenLocationIds.has(client.gbp_location_id)) {
      // Accès retiré → disconnected, jamais supprimé.
      if (client.status !== "disconnected") {
        await supabase
          .from("clients")
          .update({ status: "disconnected" })
          .eq("id", client.id);
        disconnected++;
      }
      continue;
    }

    // `accountFor` sait aussi retrouver le compte depuis la fiche seule :
    // un projet lié à la main n'a pas toujours son `gbp_account_id`.
    const location = await gbp.getLocation(
      client.gbp_account_id ?? client.gbp_location_id,
      client.gbp_location_id,
    );
    await supabase
      .from("clients")
      .update({
        ...locationSnapshot(location),
        ...(client.status === "disconnected"
          ? { status: "active" as const }
          : {}),
      })
      .eq("id", client.id);
    refreshed++;
  }

  await logActivity({
    agencyId,
    actor,
    action: "discovery_completed",
    payload: { discovered: seenLocationIds.size, refreshed, disconnected },
  });

  return { discovered: seenLocationIds.size, refreshed, disconnected };
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

  // Un seul appel pour la fiche choisie — lister les 29 fiches avec
  // leurs détails pour en trouver une était le gaspillage le plus net.
  const location = await gbp.getLocation(accountId, locationId);

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
      // Le wizard part de la fiche RÉELLE : sans ça il annonce 0 % sur
      // un commerce déjà optimisé et fait ressaisir ce que Google sait.
      gbp_profile: locationToProfile(location),
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
