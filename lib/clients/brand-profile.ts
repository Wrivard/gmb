import type { BrandProfile } from "@/lib/types/database";

// Un profil « incomplet » = les deux champs qui font la différence entre
// un draft AI générique et un draft qui parle du vrai commerce. La
// découverte ne les seed jamais (elle ne connaît que la catégorie/ville).
export function isBrandProfileIncomplete(
  profile: BrandProfile | null | undefined,
): boolean {
  return !profile?.services_cles?.length || !profile?.arguments?.length;
}
