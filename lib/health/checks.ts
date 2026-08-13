// Diagnostic de configuration — rend visible dans l'app ce qui n'est
// vérifiable nulle part ailleurs sans accès au tableau de bord Vercel.
//
// Deux angles :
//   * la configuration (présence des variables, cohérence des modes) ;
//   * la preuve de vie des crons, lue dans activity_log — une variable
//     APP_URL/CRON_SECRET manquante côté GitHub Actions ne produit
//     AUCUNE erreur visible, juste des crons qui ne partent jamais.
//
// Rien ici n'expose de valeur secrète : uniquement présence et forme.

export type HealthStatus = "ok" | "warn" | "critical";

export interface HealthCheck {
  key: string;
  label: string;
  status: HealthStatus;
  detail: string;
}

/** Ce que le diagnostic sait lire (injecté pour rester testable). */
export interface HealthEnv {
  appUrl?: string;
  encryptionKey?: string;
  cronSecret?: string;
  openaiKey?: string;
  dataforseoLogin?: string;
  dataforseoPassword?: string;
  gbpMode?: string;
  publicGbpMode?: string;
  serviceRoleKey?: string;
  notifyWebhook?: string;
  resendKey?: string;
  notifyEmailTo?: string;
}

const HEX_32_BYTES = /^[0-9a-f]{64}$/i;

/** Ce que l'app a observé, par opposition à ce qu'elle a lu dans l'env. */
export interface HealthObserved {
  /** Dernier envoi d'alerte réellement abouti (activity_log). */
  lastAlertTestAt?: string | null;
}

export function configChecks(
  env: HealthEnv,
  observed: HealthObserved = {},
  now: Date = new Date(),
): HealthCheck[] {
  const checks: HealthCheck[] = [];

  // — URL publique : sert aux liens des notifications et au kit d'avis.
  const appUrl = env.appUrl?.trim();
  checks.push({
    key: "app_url",
    label: "URL de l'application",
    ...(!appUrl
      ? { status: "critical" as const, detail: "Absente — les liens des alertes et le kit d'avis pointeront dans le vide." }
      : appUrl.includes("localhost")
        ? { status: "warn" as const, detail: `Pointe encore sur ${appUrl} — à remplacer par l'URL de production.` }
        : { status: "ok" as const, detail: appUrl }),
  });

  // — Chiffrement du refresh token Google.
  const key = env.encryptionKey?.trim();
  checks.push({
    key: "encryption",
    label: "Clé de chiffrement",
    ...(!key
      ? { status: "critical" as const, detail: "Absente — impossible de stocker la connexion Google." }
      : HEX_32_BYTES.test(key)
        ? { status: "ok" as const, detail: "32 octets, format valide." }
        : { status: "critical" as const, detail: "Format inattendu — 64 caractères hexadécimaux requis." }),
  });

  // — Secret des routes /api/cron/*.
  checks.push({
    key: "cron_secret",
    label: "Secret des tâches planifiées",
    ...(env.cronSecret?.trim()
      ? { status: "ok" as const, detail: "Présent — les routes cron sont protégées." }
      : { status: "critical" as const, detail: "Absent — toutes les tâches planifiées répondent 401." }),
  });

  // — IA (brouillons de réponses et de posts).
  checks.push({
    key: "openai",
    label: "Génération IA",
    ...(env.openaiKey?.trim()
      ? { status: "ok" as const, detail: "Clé OpenAI présente." }
      : { status: "warn" as const, detail: "Clé OpenAI absente — aucun brouillon ne sera généré." }),
  });

  // — Geogrid : sans identifiants, les scans sont simulés.
  const seo = Boolean(env.dataforseoLogin?.trim() && env.dataforseoPassword?.trim());
  checks.push({
    key: "dataforseo",
    label: "Suivi de position",
    ...(seo
      ? { status: "ok" as const, detail: "DataForSEO branché — les scans sont réels." }
      : { status: "warn" as const, detail: "Identifiants absents — les scans restent en simulation." }),
  });

  // — Les deux modes GBP doivent rester synchronisés : le serveur décide,
  //   le client affiche. Un écart fait mentir l'interface.
  const server = env.gbpMode?.trim() || "mock";
  const client = env.publicGbpMode?.trim() || "mock";
  checks.push({
    key: "gbp_mode",
    label: "Mode Google Business",
    ...(server === client
      ? { status: "ok" as const, detail: server === "real" ? "Réel des deux côtés." : "Simulation — en attente de l'approbation Google." }
      : { status: "warn" as const, detail: `Incohérent : serveur « ${server} », interface « ${client} ».` }),
  });

  // — Alertes : sans canal, un échec de publication passe inaperçu.
  const notify = Boolean(
    env.notifyWebhook?.trim() ||
      (env.resendKey?.trim() && env.notifyEmailTo?.trim()),
  );
  // « Configuré » ne veut pas dire « fonctionne » : Resend refuse tout
  // destinataire hors compte tant qu'aucun domaine n'est vérifié, et
  // l'échec est silencieux côté cron. Tant qu'un envoi réel n'a pas
  // abouti, la ligne reste un avertissement.
  checks.push({
    key: "notify",
    label: "Alertes",
    ...(!notify
      ? {
          status: "warn" as const,
          detail: "Aucun canal — avis négatif et publication échouée passeraient inaperçus.",
        }
      : observed.lastAlertTestAt
        ? {
            status: "ok" as const,
            detail: `Envoi réel confirmé ${formatElapsed(now.getTime() - new Date(observed.lastAlertTestAt).getTime())}.`,
          }
        : {
            status: "warn" as const,
            detail:
              "Canal configuré mais jamais vérifié — le fournisseur peut refuser l'envoi sans bruit. Utilise « Tester les alertes ».",
          }),
  });

  // — Choix d'architecture à assumer consciemment, pas à subir.
  checks.push({
    key: "service_role",
    label: "Accès base des tâches planifiées",
    ...(env.serviceRoleKey?.trim()
      ? { status: "warn" as const, detail: "Clé service_role active — l'app contourne les règles de sécurité de la base et s'appuie sur ses propres contrôles." }
      : { status: "ok" as const, detail: "Compte de service — les mêmes règles qu'un membre s'appliquent." }),
  });

  return checks;
}

/**
 * Preuve de vie d'une tâche planifiée. `lastAt` vient d'activity_log :
 * sans trace récente, la tâche ne part pas — cas typique d'un secret
 * absent côté GitHub Actions, qui échoue en silence.
 */
export function cronCheck(
  key: string,
  label: string,
  lastAt: string | null,
  staleAfterMs: number,
  now: Date = new Date(),
): HealthCheck {
  if (!lastAt) {
    return {
      key,
      label,
      status: "warn",
      detail: "Jamais exécutée — vérifie le secret CRON_SECRET et la variable APP_URL.",
    };
  }
  const elapsed = now.getTime() - new Date(lastAt).getTime();
  return {
    key,
    label,
    status: elapsed > staleAfterMs ? "warn" : "ok",
    detail: `Dernière exécution ${formatElapsed(elapsed)}.`,
  };
}

export function formatElapsed(ms: number): string {
  // Arrondi vers le bas partout : « il y a 1 min » pour 30 s serait faux,
  // et une tâche fraîche ne doit jamais paraître plus vieille qu'elle est.
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  return `il y a ${Math.floor(hours / 24)} j`;
}

/** Le pire statut de la liste — résume l'état en un coup d'œil. */
export function worstStatus(checks: HealthCheck[]): HealthStatus {
  if (checks.some((c) => c.status === "critical")) return "critical";
  if (checks.some((c) => c.status === "warn")) return "warn";
  return "ok";
}
