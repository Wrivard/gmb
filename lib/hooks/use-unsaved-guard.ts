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
// elles-mêmes. Les listeners sont uniques (posés au premier garde,
// retirés au dernier) — deux éditeurs dirty ne double-confirment pas.

import { useEffect } from "react";

const DEFAULT_MESSAGE =
  "Des modifications non enregistrées seront perdues. Quitter quand même ?";

interface Guard {
  isDirty: () => boolean;
  message: string;
}

// Registre global : évite de faire remonter l'état dirty par props à
// travers des arbres qui ne se connaissent pas (inbox ↔ panneau).
const guards = new Set<Guard>();

function firstDirty(): Guard | undefined {
  return [...guards].find((guard) => guard.isDirty());
}

/**
 * À appeler avant une navigation/désélection programmatique qui
 * démonterait un éditeur. Retourne true si on peut continuer.
 */
export function confirmIfUnsaved(): boolean {
  const dirty = firstDirty();
  return !dirty || window.confirm(dirty.message);
}

function onBeforeUnload(event: BeforeUnloadEvent) {
  if (!firstDirty()) return;
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
  if (!confirmIfUnsaved()) {
    // Stoppe la navigation native ET le handler de <Link> (attaché
    // sur la racine React, donc après cette capture sur document).
    event.preventDefault();
    event.stopPropagation();
  }
}

function register(guard: Guard) {
  if (guards.size === 0) {
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClickCapture, true);
  }
  guards.add(guard);
}

function unregister(guard: Guard) {
  guards.delete(guard);
  if (guards.size === 0) {
    window.removeEventListener("beforeunload", onBeforeUnload);
    document.removeEventListener("click", onClickCapture, true);
  }
}

/**
 * Déclare l'éditeur courant comme dirty tant que `dirty` est vrai.
 * `message` personnalise la confirmation (ex. batch en cours).
 */
export function useUnsavedGuard(dirty: boolean, message = DEFAULT_MESSAGE) {
  useEffect(() => {
    if (!dirty) return;
    const guard: Guard = { isDirty: () => true, message };
    register(guard);
    return () => unregister(guard);
  }, [dirty, message]);
}
