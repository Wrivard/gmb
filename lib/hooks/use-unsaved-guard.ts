"use client";

// Garde « modifications non enregistrées » : un éditeur avec du travail
// en cours s'enregistre pendant qu'il est dirty, et toute sortie
// (fermeture d'onglet, lien interne, ⌘K, changement de sélection) passe
// par confirmIfUnsaved() avant de détruire l'état local.
//
// Next App Router n'a pas d'événement de navigation annulable : on
// intercepte donc les clics d'ancres en phase capture (avant le handler
// de <Link>) + beforeunload pour les sorties dures. Les navigations
// programmatiques (palette, sélection inbox) appellent confirmIfUnsaved()
// elles-mêmes.

import { useEffect } from "react";

const MESSAGE =
  "Des modifications non enregistrées seront perdues. Quitter quand même ?";

// Registre global : évite de faire remonter l'état dirty par props à
// travers des arbres qui ne se connaissent pas (inbox ↔ panneau).
const guards = new Set<() => boolean>();

/**
 * À appeler avant une navigation/désélection programmatique qui
 * démonterait un éditeur. Retourne true si on peut continuer.
 */
export function confirmIfUnsaved(): boolean {
  const dirty = [...guards].some((isDirty) => isDirty());
  return !dirty || window.confirm(MESSAGE);
}

/** Déclare l'éditeur courant comme dirty tant que `dirty` est vrai. */
export function useUnsavedGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;

    const isDirty = () => true;
    guards.add(isDirty);

    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      // Chrome exige returnValue pour afficher le dialogue natif.
      event.returnValue = "";
    }

    function onClickCapture(event: MouseEvent) {
      if (event.defaultPrevented) return;
      // Nouvel onglet / téléchargement : l'état local survit, ne pas bloquer.
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const anchor = (event.target as HTMLElement).closest?.("a[href]");
      if (!anchor || anchor.getAttribute("target") === "_blank") return;
      const href = anchor.getAttribute("href") ?? "";
      if (href.startsWith("#")) return;
      const url = new URL(href, window.location.href);
      if (url.href === window.location.href) return;
      if (!window.confirm(MESSAGE)) {
        // Stoppe la navigation native ET le handler de <Link> (attaché
        // sur la racine React, donc après cette capture sur document).
        event.preventDefault();
        event.stopPropagation();
      }
    }

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClickCapture, true);
    return () => {
      guards.delete(isDirty);
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClickCapture, true);
    };
  }, [dirty]);
}
