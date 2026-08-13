"use client";

// Attache le membre connecté au contexte Sentry. Sans ça, une erreur
// arrive anonyme : à deux dans l'équipe, savoir QUI l'a rencontrée (et
// donc sur quel écran, avec quelles données) est la moitié du
// diagnostic. Seul le courriel est envoyé — pas d'autre donnée perso.

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export function SentryUser({ email }: { email: string | null }) {
  useEffect(() => {
    Sentry.setUser(email ? { email } : null);
  }, [email]);

  return null;
}
