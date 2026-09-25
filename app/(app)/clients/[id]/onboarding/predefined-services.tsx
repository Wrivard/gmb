"use client";

import { Checkbox } from "@/components/ui/checkbox";
import type { GbpProfileData } from "@/lib/types/database";

// Services PRÉDÉFINIS de Google, cochables depuis le wizard.
//
// C'était le plus lourd des critères non modifiables (4 points) : le
// wizard demandait d'aller les cocher sur Google. Le catalogue voyage
// pourtant avec la catégorie dans le profil de la fiche.
//
// L'enjeu n'est pas cosmétique : le test de Sterling Sky qui a mesuré
// des mouvements de classement en 24-72 h portait sur les services
// PRÉDÉFINIS, pas sur le texte libre.

type ServiceType = { id: string; label: string; category: string };

export function PredefinedServices({
  types,
  profile,
  onChange,
}: {
  /** `null` tant que la fiche n'a pas été lue. */
  types: ServiceType[] | null;
  profile: GbpProfileData;
  onChange: React.Dispatch<React.SetStateAction<GbpProfileData>>;
}) {
  const services = profile.services ?? [];
  const chosen = new Set(
    services.map((service) => service.service_type_id).filter(Boolean),
  );

  function toggle(type: ServiceType, next: boolean) {
    onChange((prev) => {
      const list = prev.services ?? [];
      if (!next) {
        return {
          ...prev,
          services: list.filter(
            (service) => service.service_type_id !== type.id,
          ),
        };
      }
      // Déjà présent en texte libre sous le même nom ? On le convertit
      // plutôt que d'en créer un doublon sur la fiche.
      const existing = list.findIndex(
        (service) =>
          !service.service_type_id &&
          service.name.trim().toLowerCase() === type.label.toLowerCase(),
      );
      if (existing !== -1) {
        const next = [...list];
        next[existing] = { ...next[existing], service_type_id: type.id };
        return { ...prev, services: next };
      }
      return {
        ...prev,
        services: [...list, { name: type.label, service_type_id: type.id }],
      };
    });
  }

  if (types === null) {
    return (
      <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
        Services prédéfinis non chargés — lis la fiche depuis l&apos;étape
        Catégories.
      </p>
    );
  }

  if (!types.length) {
    return (
      <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
        Google ne propose aucun service prédéfini pour cette catégorie —
        décris-les en texte libre ci-dessous.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <p className="text-sm font-medium">
        Services proposés par Google
        <span className="ml-2 text-xs font-normal text-muted-foreground">
          {chosen.size}/{types.length} retenus
        </span>
      </p>
      <p className="text-xs text-muted-foreground">
        Coche ceux que l&apos;entreprise offre vraiment. Ils partent vers la
        fiche avec le reste de l&apos;étape.
      </p>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {types.map((type) => (
          <label
            key={type.id}
            className="flex items-start gap-2 text-sm"
            title={type.category}
          >
            <Checkbox
              className="mt-0.5"
              checked={chosen.has(type.id)}
              onCheckedChange={(next) => toggle(type, Boolean(next))}
            />
            <span>{type.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
