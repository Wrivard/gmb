import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { frCA } from "date-fns/locale";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { getSessionContext } from "@/lib/auth";
import { getDb } from "@/lib/supabase/db";
import { supabaseConfigured } from "@/lib/env";
import { loadMonthlyReport } from "@/lib/clients/report";
import { torontoParts } from "@/lib/due";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StarRating } from "@/components/reviews/star-rating";
import { cn } from "@/lib/utils";
import { PrintButton } from "./print-button";

export const metadata = { title: "Rapport mensuel" };

// Le livrable client : ce qu'on a fait ce mois-ci sur sa fiche Google.
// Print-friendly — le chrome de l'app (sidebar/topbar) est print:hidden,
// l'export PDF passe par l'impression navigateur.

function shiftMonth(key: string, delta: number): string {
  const [year, month] = key.split("-").map(Number);
  const total = year * 12 + (month - 1) + delta;
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

function currentMonthKey(): string {
  const { year, month } = torontoParts(new Date());
  return `${year}-${String(month).padStart(2, "0")}`;
}

export default async function MonthlyReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mois?: string }>;
}) {
  const { id } = await params;
  const { mois } = await searchParams;

  if (!supabaseConfigured()) {
    return (
      <EmptyState
        title="Rapport indisponible en mode démo"
        hint="Branche Supabase pour générer les rapports mensuels."
      />
    );
  }

  const { member } = await getSessionContext();
  if (!member) return null; // Le layout gère la whitelist.

  const supabase = await getDb();
  const { data: client, error } = await supabase
    .from("clients")
    .select("id, name, primary_category, address")
    .eq("id", id)
    .eq("agency_id", member.agency_id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!client) notFound();

  // Défaut : le mois précédent — le rapport se présente en début de mois.
  const current = currentMonthKey();
  const monthKey = /^\d{4}-(0[1-9]|1[0-2])$/.test(mois ?? "")
    ? mois!
    : shiftMonth(current, -1);
  const report = await loadMonthlyReport(client.id, monthKey);

  const delta =
    report.ratingStart !== null && report.ratingEnd !== null
      ? Math.round((report.ratingEnd - report.ratingStart) * 10) / 10
      : null;

  const stats = [
    {
      label: "Note moyenne",
      value:
        report.ratingEnd !== null
          ? report.ratingEnd.toFixed(1).replace(".", ",")
          : "—",
      hint:
        delta !== null && delta !== 0
          ? `${delta > 0 ? "+" : ""}${delta.toFixed(1).replace(".", ",")} ce mois`
          : undefined,
    },
    { label: "Reviews reçues", value: String(report.reviewsReceived) },
    { label: "Réponses publiées", value: String(report.replies.length) },
    {
      label: "Posts publiés",
      value: report.coverage
        ? `${report.posts.length}/${report.coverage.target}`
        : String(report.posts.length),
      alert: Boolean(
        report.coverage && report.posts.length < report.coverage.target,
      ),
    },
  ];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      {/* Barre d'outils — pas dans le PDF. */}
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Button
          variant="ghost"
          size="sm"
          render={<Link href={`/clients/${client.id}`} />}
        >
          <ArrowLeft />
          Projet
        </Button>
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Mois précédent"
            render={
              <Link
                href={`/clients/${client.id}/rapport?mois=${shiftMonth(monthKey, -1)}`}
              />
            }
          >
            <ChevronLeft />
          </Button>
          <span className="min-w-32 text-center text-sm capitalize">
            {report.monthLabel}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Mois suivant"
            disabled={monthKey >= shiftMonth(current, -1)}
            render={
              <Link
                href={`/clients/${client.id}/rapport?mois=${shiftMonth(monthKey, 1)}`}
              />
            }
          >
            <ChevronRight />
          </Button>
          <PrintButton />
        </div>
      </div>

      {/* En-tête du rapport. */}
      <header className="flex flex-col gap-1 border-b border-border pb-4">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Rapport mensuel — fiche Google Business Profile
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {client.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          {[client.primary_category, client.address]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <p className="text-sm capitalize text-muted-foreground">
          {report.monthLabel}
        </p>
      </header>

      {/* Les 4 chiffres du mois. */}
      <div className="grid gap-2 sm:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-border bg-elevated px-4 py-3"
          >
            <div
              className={cn(
                "text-2xl font-semibold tabular-nums",
                stat.alert && "text-warning",
              )}
            >
              {stat.value}
            </div>
            <div className="text-xs text-muted-foreground">{stat.label}</div>
            {stat.hint && (
              <div className="text-xs font-medium text-success">
                {stat.hint}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Posts publiés. */}
      <section>
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">
          Publications du mois
        </h2>
        {report.posts.length ? (
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-elevated">
            {report.posts.map((post) => (
              <li key={post.id} className="flex gap-3 p-4">
                {post.imageUrl && (
                  <div className="relative size-20 shrink-0 overflow-hidden rounded-md bg-muted">
                    <Image
                      src={post.imageUrl}
                      alt=""
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">
                    Publié le{" "}
                    {format(new Date(post.publishedAt), "d MMMM", {
                      locale: frCA,
                    })}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm">
                    {post.summary}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState size="sm" title="Aucun post publié ce mois-ci." />
        )}
      </section>

      {/* Réponses aux reviews. */}
      <section>
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">
          Réponses aux avis publiées
        </h2>
        {report.replies.length ? (
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-elevated">
            {report.replies.map((reply, index) => (
              <li key={index} className="flex flex-col gap-1.5 p-4">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium">
                    {reply.reviewerName ?? "Utilisateur Google"}
                  </span>
                  <StarRating value={reply.starRating} size="sm" />
                  <span className="ml-auto text-xs text-muted-foreground">
                    {format(new Date(reply.publishedAt), "d MMMM", {
                      locale: frCA,
                    })}
                  </span>
                </div>
                {reply.comment && (
                  <p className="text-sm text-muted-foreground">
                    « {reply.comment} »
                  </p>
                )}
                <p className="text-sm">
                  <span className="text-xs font-medium uppercase tracking-wide text-success">
                    Notre réponse —{" "}
                  </span>
                  {reply.replyText}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState size="sm" title="Aucune réponse publiée ce mois-ci." />
        )}
      </section>

      <p className="pb-6 text-center text-xs text-muted-foreground">
        Généré par Küa Locale — {format(new Date(), "d MMMM yyyy", { locale: frCA })}
      </p>
    </div>
  );
}
