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

async function sendResendEmail(apiKey: string, notification: Notification) {
  const to = process.env.NOTIFY_EMAIL_TO;
  if (!to) throw new Error("NOTIFY_EMAIL_TO manquant");
  const from =
    process.env.NOTIFY_EMAIL_FROM ?? "Küa Locale <onboarding@resend.dev>";

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
    throw new Error(`resend ${response.status}: ${await response.text()}`);
  }
}

/**
 * Envoie sur tous les canaux configurés. Retourne true si au moins un
 * canal a accepté. Ne throw jamais.
 */
export async function sendNotification(
  notification: Notification,
): Promise<boolean> {
  const webhookUrl = process.env.NOTIFY_WEBHOOK_URL;
  const resendKey = process.env.RESEND_API_KEY;

  if (!webhookUrl && !resendKey) {
    console.log(
      `[notify] aucun canal configuré — « ${notification.subject} » non envoyé`,
    );
    return false;
  }

  let delivered = false;
  if (webhookUrl) {
    try {
      await sendWebhook(webhookUrl, notification);
      delivered = true;
    } catch (error) {
      console.error("[notify] webhook échoué :", error);
    }
  }
  if (resendKey) {
    try {
      await sendResendEmail(resendKey, notification);
      delivered = true;
    } catch (error) {
      console.error("[notify] courriel échoué :", error);
    }
  }
  return delivered;
}

export function appLink(path: string): string {
  return `${APP_URL}${path}`;
}
