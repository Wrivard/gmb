import "server-only";

import { getDb } from "@/lib/supabase/db";
import { getGbpClient } from "./client";
import type { GbpLocation } from "./types";
import type { BrandProfile } from "@/lib/types/database";
import { logActivity } from "@/lib/activity";

// Découverte plug-and-play des fiches GBP (specs/02 §C) :
// accounts.list → locations.list → upsert clients.
// Nouvelle location → active avec défauts; disparue → disconnected.

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

export interface DiscoveryResult {
  discovered: number;
  created: number;
  disconnected: number;
}

export async function runDiscovery(
  agencyId: string,
  actor: string,
): Promise<DiscoveryResult> {
  const gbp = getGbpClient();
  const supabase = await getDb();

  const { data: agency } = await supabase
    .from("agencies")
    .select("default_posts_per_month, default_language")
    .eq("id", agencyId)
    .single();

  const accounts = await gbp.listAccounts();
  const seenLocationIds = new Set<string>();
  let created = 0;
  let discovered = 0;

  for (const account of accounts) {
    const locations = await gbp.listLocations(account.name);
    for (const location of locations) {
      discovered++;
      seenLocationIds.add(location.name);

      const { data: existing } = await supabase
        .from("clients")
        .select("id, status")
        .eq("gbp_location_id", location.name)
        .maybeSingle();

      if (existing) {
        // Snapshot de fiche rafraîchi; on ne touche pas aux réglages.
        // Un projet archivé (offboardé) reste archivé même si la fiche
        // est toujours accessible côté Google.
        await supabase
          .from("clients")
          .update({
            address: formatAddress(location),
            phone: location.phoneNumbers?.primaryPhone ?? null,
            website: location.websiteUri ?? null,
            primary_category:
              location.categories?.primaryCategory?.displayName ?? null,
            ...(existing.status === "disconnected"
              ? { status: "active" as const }
              : {}),
          })
          .eq("id", existing.id);
      } else {
        // Opt-in (specs/02 §C.4) : une fiche découverte n'est pas
        // forcément un mandat payant. Elle arrive en pause — l'équipe
        // active celles sous mandat depuis Projets.
        await supabase.from("clients").insert({
          agency_id: agencyId,
          gbp_account_id: account.name,
          gbp_location_id: location.name,
          name: location.title,
          address: formatAddress(location),
          phone: location.phoneNumbers?.primaryPhone ?? null,
          website: location.websiteUri ?? null,
          primary_category:
            location.categories?.primaryCategory?.displayName ?? null,
          posts_per_month: agency?.default_posts_per_month ?? 2,
          language: agency?.default_language ?? "fr-CA",
          brand_profile: defaultBrandProfile(location),
          status: "paused",
        });
        created++;
      }
    }
  }

  // Locations disparues (accès retiré) → disconnected, jamais supprimées.
  // Les archivés sont hors jeu : ne pas les basculer disconnected.
  const { data: allClients } = await supabase
    .from("clients")
    .select("id, gbp_location_id, status")
    .eq("agency_id", agencyId)
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
    payload: { discovered, created, disconnected },
  });

  return { discovered, created, disconnected };
}
