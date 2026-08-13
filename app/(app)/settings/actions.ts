"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import {
  getMemberDb,
  getOwnerDb,
  requireMember,
  requireOwner,
  runAction,
  type ActionResult,
} from "@/lib/actions/member";
import * as Sentry from "@sentry/nextjs";
import { DATA_MODE_COOKIE, type DataMode } from "@/lib/data-mode";
import { runDiscovery } from "@/lib/gbp/discovery";
import { logActivity } from "@/lib/activity";
import {
  appLink,
  deliverNotification,
  type ChannelResult,
} from "@/lib/notify";

/** Bascule réel ↔ démo (cookie par navigateur — voir lib/data-mode.ts). */
export async function setDataModeAction(mode: DataMode): Promise<ActionResult> {
  return runAction("Le changement de mode a échoué.", async () => {
    await requireMember();
    const store = await cookies();
    store.set(DATA_MODE_COOKIE, mode === "demo" ? "demo" : "real", {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
      httpOnly: true,
    });
    revalidatePath("/", "layout");
    return { ok: true };
  });
}

export async function resyncClientsAction(): Promise<
  ActionResult & { created?: number; discovered?: number }
> {
  return runAction("La resynchronisation a échoué.", async () => {
    const member = await requireMember();
    const result = await runDiscovery(member.agency_id, member.email);
    revalidatePath("/settings");
    revalidatePath("/clients");
    return { ok: true, ...result };
  });
}

export async function toggleClientActiveAction(
  clientId: string,
  active: boolean,
): Promise<ActionResult> {
  return runAction("Échec de la mise à jour.", async () => {
    const { member, supabase } = await getMemberDb();
    const { error } = await supabase
      .from("clients")
      .update({ status: active ? "active" : "paused" })
      .eq("id", clientId)
      .eq("agency_id", member.agency_id)
      .neq("status", "disconnected");
    if (error) throw new Error(error.message);
    revalidatePath("/settings");
    revalidatePath("/");
    return { ok: true };
  });
}

export async function addMemberAction(
  email: string,
  role: "owner" | "member",
): Promise<ActionResult> {
  return runAction("Échec de l'ajout.", async () => {
    const { member, supabase } = await getOwnerDb(
      "Seul un admin peut gérer l'équipe.",
    );
    const trimmed = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
      return { ok: false, error: "Courriel invalide." };
    }
    const { error } = await supabase.from("agency_members").insert({
      agency_id: member.agency_id,
      email: trimmed,
      role,
    });
    if (error) {
      if (error.code === "23505") {
        return { ok: false, error: "Ce courriel est déjà dans l'équipe." };
      }
      throw new Error(error.message);
    }
    await logActivity({
      agencyId: member.agency_id,
      actor: member.email,
      action: "member_added",
      payload: { email: trimmed, role },
    });
    revalidatePath("/settings");
    return { ok: true };
  });
}

export async function removeMemberAction(
  memberId: string,
): Promise<ActionResult> {
  return runAction("Échec du retrait.", async () => {
    const { member, supabase } = await getOwnerDb(
      "Seul un admin peut gérer l'équipe.",
    );
    if (member.id === memberId) {
      return { ok: false, error: "Tu ne peux pas te retirer toi-même." };
    }
    const { error } = await supabase
      .from("agency_members")
      .delete()
      .eq("id", memberId)
      .eq("agency_id", member.agency_id);
    if (error) throw new Error(error.message);
    revalidatePath("/settings");
    return { ok: true };
  });
}

/**
 * Envoie une vraie alerte de test sur les canaux configurés et rapporte
 * le détail par canal. Sans ça, on découvre qu'un canal est cassé le
 * jour d'une 1★ — et le piège le plus courant (Resend refuse tout
 * destinataire hors compte tant qu'aucun domaine n'est vérifié) est
 * invisible autrement.
 */
export async function sendTestAlertAction(): Promise<
  ActionResult & { results?: ChannelResult[] }
> {
  return runAction("L'envoi de test a échoué.", async () => {
    const member = await requireOwner("Seul un admin peut tester les alertes.");
    const results = await deliverNotification({
      subject: "✅ Test des alertes — Küa Locale",
      text:
        `Ce message confirme que le canal d'alerte fonctionne.\n\n` +
        `Déclenché par ${member.email}.\n\n` +
        `C'est par ici que passeront les avis négatifs et les publications échouées : ${appLink("/")}`,
    });
    if (!results.length) {
      return {
        ok: false,
        error:
          "Aucun canal configuré — ajoute NOTIFY_EMAIL_TO (avec RESEND_API_KEY) ou NOTIFY_WEBHOOK_URL.",
      };
    }
    // Trace du dernier envoi ABOUTI : c'est elle qui fait passer la ligne
    // « Alertes » du diagnostic au vert. Un canal configuré mais refusé
    // par son fournisseur ne doit pas compter comme fonctionnel.
    if (results.some((result) => result.ok)) {
      await logActivity({
        agencyId: member.agency_id,
        actor: member.email,
        action: "alert_test_sent",
        payload: { channels: results.filter((r) => r.ok).map((r) => r.channel) },
      });
      revalidatePath("/settings");
    }
    return { ok: true, results };
  });
}

/**
 * Envoie une exception de test à Sentry et rend son identifiant, pour
 * vérifier la chaîne complète (DSN, réseau, projet) sans provoquer un
 * vrai plantage. `flush` est indispensable en serverless : sans lui la
 * fonction se termine avant l'envoi.
 */
export async function sendTestSentryAction(): Promise<
  ActionResult & { eventId?: string }
> {
  return runAction("L'envoi vers Sentry a échoué.", async () => {
    const member = await requireOwner("Seul un admin peut tester Sentry.");
    // Niveau « error » volontairement : le but est de vérifier le chemin
    // qu'emprunte une VRAIE erreur. En « info », l'événement partait bien
    // mais n'apparaissait dans aucune des vues où on cherche une erreur.
    const eventId = Sentry.captureException(
      new Error(`Test de diagnostic Küa Locale — déclenché par ${member.email}`),
      { tags: { source: "diagnostic" } },
    );
    const flushed = await Sentry.flush(5000);
    if (!flushed) {
      return {
        ok: false,
        error: "Sentry n'a pas confirmé l'envoi (délai dépassé).",
      };
    }
    return { ok: true, eventId };
  });
}

export async function updateAgencyDefaultsAction(input: {
  defaultPostsPerMonth: number;
  defaultLanguage: string;
}): Promise<ActionResult> {
  return runAction("Échec de la mise à jour.", async () => {
    const { member, supabase } = await getOwnerDb(
      "Seul un admin peut modifier les défauts.",
    );
    const posts = Math.max(0, Math.min(10, Math.round(input.defaultPostsPerMonth)));
    const { error } = await supabase
      .from("agencies")
      .update({
        default_posts_per_month: posts,
        default_language: input.defaultLanguage,
      })
      .eq("id", member.agency_id);
    if (error) throw new Error(error.message);
    revalidatePath("/settings");
    return { ok: true };
  });
}
