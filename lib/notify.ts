import "server-only";

// Canal sortant de l'app — l'équipe ne doit pas avoir l'onglet ouvert
// pour savoir qu'une 1★ est tombée ou que la connexion Google est morte.
// Deux canaux optionnels, zéro dépendance :
//   - NOTIFY_WEBHOOK_URL : POST {text} (format Slack incoming webhook)
//   - RESEND_API_KEY + NOTIFY_EMAIL_TO (+ NOTIFY_EMAIL_FROM) : courriel
// Aucun configuré → no-op loggé. L'échec d'une notification ne doit
// JAMAIS faire échouer l'action qui la déclenche.

const APP_URL = process.env.APP_URL ?? "https://kua-locale.vercel.app";

export interface Notification {
  /** Sujet court — devient le sujet du courriel. */
  subject: string;
  /** Corps texte simple (pas de HTML), liens absolus inclus. */
  text: string;
}

async function sendWebhook(url: string, notification: Notification) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: `*${notification.subject}*\n${notification.text}`,
    }),
  });
  if (!response.ok) {
    throw new Error(`webhook ${response.status}`);
  }
}

/** Expéditeur bac à sable de Resend : il n'accepte QUE le propriétaire
    du compte comme destinataire, même si ton domaine est vérifié. */
const RESEND_SANDBOX_FROM = "Küa Locale <onboarding@resend.dev>";

async function sendResendEmail(apiKey: string, notification: Notification) {
  const to = process.env.NOTIFY_EMAIL_TO;
  if (!to) throw new Error("NOTIFY_EMAIL_TO manquant");
  const from = process.env.NOTIFY_EMAIL_FROM?.trim() || RESEND_SANDBOX_FROM;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: to.split(",").map((address) => address.trim()),
      subject: notification.subject,
      text: notification.text,
    }),
  });
  if (!response.ok) {
    const body = await response.text();
    // Le message de Resend parle de vérifier un domaine ET de changer
    // l'expéditeur. Quand le domaine est déjà vérifié, seule la seconde
    // moitié s'applique — et rien ne le dit. On lève l'ambiguïté ici.
    const hint =
      from === RESEND_SANDBOX_FROM
        ? " — expéditeur bac à sable : pose NOTIFY_EMAIL_FROM sur une adresse de ton domaine vérifié."
        : "";
    throw new Error(`resend ${response.status}: ${body}${hint}`);
  }
}

export interface ChannelResult {
  channel: "webhook" | "courriel";
  ok: boolean;
  /** Message d'erreur du fournisseur — sert au bouton de test. */
  error?: string;
}

/**
 * Tente chaque canal configuré et rapporte le détail. Ne throw jamais.
 * Utilisé tel quel par le bouton « Tester les alertes » : sans le
 * message du fournisseur, un envoi refusé (domaine non vérifié chez
 * Resend, webhook expiré) reste indevinable.
 */
export async function deliverNotification(
  notification: Notification,
): Promise<ChannelResult[]> {
  const webhookUrl = process.env.NOTIFY_WEBHOOK_URL;
  const resendKey = process.env.RESEND_API_KEY;
  const results: ChannelResult[] = [];

  if (webhookUrl) {
    try {
      await sendWebhook(webhookUrl, notification);
      results.push({ channel: "webhook", ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[notify] webhook échoué :", error);
      results.push({ channel: "webhook", ok: false, error: message });
    }
  }
  if (resendKey) {
    try {
      await sendResendEmail(resendKey, notification);
      results.push({ channel: "courriel", ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[notify] courriel échoué :", error);
      results.push({ channel: "courriel", ok: false, error: message });
    }
  }
  return results;
}

/**
 * Envoie sur tous les canaux configurés. Retourne true si au moins un
 * canal a accepté. Ne throw jamais.
 */
export async function sendNotification(
  notification: Notification,
): Promise<boolean> {
  const results = await deliverNotification(notification);
  if (!results.length) {
    console.log(
      `[notify] aucun canal configuré — « ${notification.subject} » non envoyé`,
    );
    return false;
  }
  return results.some((result) => result.ok);
}

export function appLink(path: string): string {
  return `${APP_URL}${path}`;
}
