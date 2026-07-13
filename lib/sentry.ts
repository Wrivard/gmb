// Config Sentry partagée (client, server, edge).
// Erreurs seulement — tracing et replay désactivés pour rester dans le
// plan gratuit (5k erreurs/mois). Le DSN est public par design.
export const SENTRY_DSN =
  "https://e077cd49b52f18ff84891ea497f94920@o4510269433118720.ingest.us.sentry.io/4510269435281408";

// Actif seulement en prod : les erreurs de dev n'ont pas leur place dans
// le quota ni dans le feed d'issues.
export const SENTRY_ENABLED = process.env.NODE_ENV === "production";
