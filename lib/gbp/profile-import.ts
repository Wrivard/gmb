import type { GbpLocation, GbpTimePeriod } from "./types";
import type {
  GbpDayHours,
  GbpProfileData,
  GbpWeekday,
} from "@/lib/types/database";

// Fiche Google → `clients.gbp_profile`.
//
// Sans ce pont, un projet importé partait avec un profil VIDE : le
// wizard annonçait « 0 % optimisé » sur une fiche qui avait déjà sa
// description, ses horaires et sa catégorie, et demandait de ressaisir
// à la main ce que Google savait déjà. Le score doit mesurer la fiche,
// pas le remplissage de notre formulaire.
//
// Pas de "server-only" : mappeur pur, testé sans réseau.

const DAY_BY_GOOGLE: Record<string, GbpWeekday> = {
  MONDAY: "monday",
  TUESDAY: "tuesday",
  WEDNESDAY: "wednesday",
  THURSDAY: "thursday",
  FRIDAY: "friday",
  SATURDAY: "saturday",
  SUNDAY: "sunday",
};

const ALL_DAYS = Object.values(DAY_BY_GOOGLE);

/** `{ hours: 9 }` → « 09:00 ». Une heure absente vaut minuit chez Google. */
function formatTime(time: GbpTimePeriod["openTime"]): string {
  const hours = time?.hours ?? 0;
  const minutes = time?.minutes ?? 0;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/**
 * Périodes Google → horaires par jour.
 *
 * Google peut décrire un jour en plusieurs tranches (fermeture du midi).
 * Notre modèle n'en garde qu'une : on prend la plus large (première
 * ouverture, dernière fermeture) plutôt que d'en perdre une. Un jour
 * sans période est explicitement `null` — fermé, ce qui n'est pas la
 * même chose qu'inconnu.
 */
export function periodsToHours(
  periods: GbpTimePeriod[] | undefined,
): GbpProfileData["hours"] | undefined {
  if (!periods?.length) return undefined;

  const hours: Partial<Record<GbpWeekday, GbpDayHours | null>> = {};
  for (const period of periods) {
    const day = DAY_BY_GOOGLE[period.openDay?.toUpperCase() ?? ""];
    if (!day) continue;
    const open = formatTime(period.openTime);
    const close = formatTime(period.closeTime);
    const known = hours[day];
    hours[day] = known
      ? {
          open: open < known.open ? open : known.open,
          close: close > known.close ? close : known.close,
        }
      : { open, close };
  }

  if (!Object.keys(hours).length) return undefined;
  for (const day of ALL_DAYS) {
    if (!(day in hours)) hours[day] = null;
  }
  return hours;
}

/** Adresse postale Google → une ligne, comme la saisit le wizard. */
function formatAddress(location: GbpLocation): string | undefined {
  const addr = location.storefrontAddress;
  if (!addr) return undefined;
  const parts = [
    ...(addr.addressLines ?? []),
    [addr.locality, addr.administrativeArea].filter(Boolean).join(", "),
    addr.postalCode,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : undefined;
}

function toServices(
  items: GbpLocation["serviceItems"],
): GbpProfileData["services"] | undefined {
  const services = (items ?? [])
    .map((item) => {
      const free = item.freeFormServiceItem?.label;
      if (free?.displayName) {
        return { name: free.displayName, description: free.description };
      }
      // Service structuré : l'identifiant Google (`job_type_id:...`) est
      // la seule étiquette disponible sans le référentiel de catégories.
      const id = item.structuredServiceItem?.serviceTypeId;
      if (!id) return null;
      return {
        name: id.split(":").pop()?.replace(/_/g, " ") ?? id,
        description: item.structuredServiceItem?.description,
      };
    })
    .filter((service) => service !== null);
  return services.length ? services : undefined;
}

/**
 * Construit le profil à partir de la fiche. Ne rend QUE ce que Google
 * porte : un champ absent reste absent, pour que le wizard continue de
 * le signaler comme à faire.
 */
export function locationToProfile(location: GbpLocation): GbpProfileData {
  const profile: GbpProfileData = {};

  const primary = location.categories?.primaryCategory?.displayName;
  const additional = (location.categories?.additionalCategories ?? [])
    .map((category) => category.displayName)
    .filter((name): name is string => Boolean(name));
  if (primary || additional.length) {
    profile.categories = {
      ...(primary ? { primary } : {}),
      ...(additional.length ? { additional } : {}),
    };
  }

  const identity = {
    ...(location.title ? { name: location.title } : {}),
    ...(location.phoneNumbers?.primaryPhone
      ? { phone: location.phoneNumbers.primaryPhone }
      : {}),
    ...(location.websiteUri ? { website: location.websiteUri } : {}),
    ...(formatAddress(location) ? { address: formatAddress(location) } : {}),
  };
  if (Object.keys(identity).length) profile.identity = identity;

  const hours = periodsToHours(location.regularHours?.periods);
  if (hours) profile.hours = hours;

  const description = location.profile?.description?.trim();
  if (description) profile.description = description;

  const opened = location.openInfo?.openingDate;
  if (opened?.year) {
    profile.opening_date = `${opened.year}-${String(opened.month ?? 1).padStart(2, "0")}`;
  }

  const services = toServices(location.serviceItems);
  if (services) profile.services = services;

  return profile;
}

/**
 * Fusionne la fiche dans un profil existant sans écraser le travail de
 * l'équipe : ce qui a été saisi dans l'app gagne. Google ne sert qu'à
 * combler les trous — sinon un rafraîchissement effacerait une
 * description retravaillée mais pas encore poussée.
 */
export function mergeProfile(
  current: GbpProfileData,
  fromGoogle: GbpProfileData,
): GbpProfileData {
  return {
    ...fromGoogle,
    ...current,
    categories: current.categories ?? fromGoogle.categories,
    identity: { ...fromGoogle.identity, ...current.identity },
    hours: current.hours ?? fromGoogle.hours,
    description: current.description ?? fromGoogle.description,
    opening_date: current.opening_date ?? fromGoogle.opening_date,
    services: current.services?.length
      ? current.services
      : fromGoogle.services,
  };
}
