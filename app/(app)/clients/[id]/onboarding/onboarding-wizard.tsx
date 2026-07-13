"use client";

// Wizard d'optimisation de la fiche GBP — l'onboarding guidé d'un
// nouveau projet. Chaque étape dit POURQUOI (impact classé par les
// études de ranking local) et chaque item se coche une fois fait sur
// la fiche Google. Rien ne se saute en silence : le score est visible
// partout tant que la fiche n'est pas à 100 %.

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ExternalLink,
  PartyPopper,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  ONBOARDING_STEPS,
  onboardingProgress,
} from "@/lib/onboarding/steps";
import type { ClientStatus, OnboardingState } from "@/lib/types/database";
import {
  completeOnboardingAction,
  setOnboardingItemAction,
} from "../actions";
import { toggleClientActiveAction } from "@/app/(app)/settings/actions";

export function OnboardingWizard({
  clientId,
  clientName,
  clientStatus,
  initialState,
}: {
  clientId: string;
  clientName: string;
  clientStatus: ClientStatus;
  initialState: OnboardingState;
}) {
  const router = useRouter();
  const [checked, setChecked] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    for (const [key, item] of Object.entries(initialState.items ?? {})) {
      if (item.done) map[key] = true;
    }
    return map;
  });
  // Première étape pas encore complétée = point de reprise naturel.
  const [stepIndex, setStepIndex] = useState(() => {
    const progress = onboardingProgress(initialState);
    const index = ONBOARDING_STEPS.findIndex(
      (step) => !progress.doneSteps.has(step.key),
    );
    return index === -1 ? 0 : index;
  });
  const [activating, startActivate] = useTransition();
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulking, startBulk] = useTransition();

  const progress = useMemo(
    () =>
      onboardingProgress({
        items: Object.fromEntries(
          Object.entries(checked).map(([key, done]) => [key, { done }]),
        ),
      }),
    [checked],
  );

  const step = ONBOARDING_STEPS[stepIndex];
  const stepDone = progress.doneSteps.has(step.key);

  function toggle(itemKey: string) {
    const next = !checked[itemKey];
    // Optimiste : la coche répond au doigt; le serveur suit.
    setChecked((prev) => ({ ...prev, [itemKey]: next }));
    void setOnboardingItemAction(clientId, itemKey, next).then((result) => {
      if (!result.ok) {
        setChecked((prev) => ({ ...prev, [itemKey]: !next }));
        toast.error(result.error);
      } else {
        router.refresh();
      }
    });
  }

  function activate() {
    startActivate(async () => {
      const result = await toggleClientActiveAction(clientId, true);
      if (result.ok) {
        toast.success(`${clientName} est actif — le mandat roule.`);
        router.push(`/clients/${clientId}`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function bulkComplete() {
    startBulk(async () => {
      const result = await completeOnboardingAction(clientId);
      if (result.ok) {
        setChecked(
          Object.fromEntries(
            ONBOARDING_STEPS.flatMap((step) =>
              step.items.map((item) => [item.key, true]),
            ),
          ),
        );
        setBulkOpen(false);
        toast.success("Checklist complétée — la fiche est marquée optimisée.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      {/* En-tête : contexte + progression globale toujours visible. */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          render={<Link href={`/clients/${clientId}`} />}
        >
          <ArrowLeft />
          {clientName}
        </Button>
        <h1 className="text-xl font-semibold tracking-tight">
          Optimisation de la fiche
        </h1>
        <div className="ml-auto flex items-center gap-3">
          <div className="h-1.5 w-36 overflow-hidden rounded-full bg-muted">
            <motion.div
              className={cn(
                "h-full rounded-full",
                progress.complete ? "bg-success" : "bg-primary",
              )}
              initial={false}
              animate={{ width: `${progress.pct}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>
          <span className="text-sm tabular-nums text-muted-foreground">
            {progress.done}/{progress.total}
          </span>
        </div>
      </div>

      {progress.complete && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-success/30 bg-success/10 px-4 py-3">
          <PartyPopper className="size-4 text-success" />
          <p className="text-sm">
            <span className="font-medium">Fiche 100 % optimisée.</span>{" "}
            <span className="text-muted-foreground">
              Le quotidien (reviews, posts) prend le relais.
            </span>
          </p>
          {clientStatus === "paused" && (
            <Button
              size="sm"
              className="ml-auto"
              onClick={activate}
              disabled={activating}
            >
              {activating ? "Activation…" : "Activer le mandat"}
            </Button>
          )}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-[240px_1fr]">
        {/* Rail des étapes — horizontal (défilant) sur mobile. */}
        <div className="flex flex-col gap-2">
          <nav className="flex gap-1 overflow-x-auto pb-1 md:flex-col md:overflow-visible md:pb-0">
            {ONBOARDING_STEPS.map((entry, index) => {
              const done = progress.doneSteps.has(entry.key);
              const active = index === stepIndex;
              const doneCount = entry.items.filter(
                (item) => checked[item.key],
              ).length;
              return (
                <button
                  key={entry.key}
                  type="button"
                  onClick={() => setStepIndex(index)}
                  className={cn(
                    "flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50 md:whitespace-normal",
                    active
                      ? "bg-muted font-medium text-foreground"
                      : "text-muted-foreground hover:bg-hover hover:text-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full text-xs tabular-nums",
                      done
                        ? "bg-success text-primary-foreground"
                        : "bg-muted-foreground/15",
                    )}
                  >
                    {done ? <Check className="size-3" /> : index + 1}
                  </span>
                  <span className="flex-1">{entry.title}</span>
                  {/* Entamée ≠ intacte : le compteur le montre d'un œil. */}
                  {!done && doneCount > 0 && (
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {doneCount}/{entry.items.length}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
          <div className="hidden flex-col gap-2 border-t border-border pt-3 md:flex">
            <a
              href="https://business.google.com/locations"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <ExternalLink className="size-3" />
              Ouvrir Google Business Profile
            </a>
            {!progress.complete && (
              <AlertDialog open={bulkOpen} onOpenChange={setBulkOpen}>
                <AlertDialogTrigger
                  render={
                    <button
                      type="button"
                      className="px-3 text-left text-xs text-muted-foreground/70 underline-offset-2 transition-colors hover:text-foreground hover:underline"
                    >
                      Fiche déjà optimisée ? Tout marquer comme fait
                    </button>
                  }
                />
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Marquer toute la checklist comme faite ?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      Pour les fiches déjà optimisées (clients de longue
                      date). Les {progress.total - progress.done} points
                      restants seront cochés à ton nom — c&apos;est ton
                      affirmation que la fiche de {clientName} est
                      réellement à niveau.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={bulking}>
                      Annuler
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={bulkComplete}
                      disabled={bulking}
                    >
                      {bulking ? "…" : "Tout marquer comme fait"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

        {/* Panneau de l'étape courante */}
        <motion.section
          key={step.key}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="rounded-lg border border-border bg-elevated p-5"
        >
          <div className="mb-4">
            <h2 className="text-base font-semibold tracking-tight">
              {stepIndex + 1}. {step.title}
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">{step.why}</p>
          </div>

          <ul className="flex flex-col divide-y divide-border/60">
            {step.items.map((item) => {
              const done = Boolean(checked[item.key]);
              return (
                <li key={item.key}>
                  <label className="flex cursor-pointer items-start gap-3 py-3">
                    <Checkbox
                      checked={done}
                      onCheckedChange={() => toggle(item.key)}
                      className="mt-0.5"
                      aria-label={item.label}
                    />
                    <span className="min-w-0">
                      <span
                        className={cn(
                          "block text-sm",
                          done && "text-muted-foreground line-through",
                        )}
                      >
                        {item.label}
                      </span>
                      {item.hint && (
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {item.hint}
                        </span>
                      )}
                    </span>
                    {item.appTab && (
                      <Link
                        href={`/clients/${clientId}?tab=${item.appTab}`}
                        onClick={(event) => event.stopPropagation()}
                        className="ml-auto shrink-0 self-center text-xs font-medium text-primary underline-offset-2 hover:underline"
                      >
                        Ouvrir →
                      </Link>
                    )}
                  </label>
                </li>
              );
            })}
          </ul>

          <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
              disabled={stepIndex === 0}
            >
              <ArrowLeft />
              Précédent
            </Button>
            <p className="text-xs text-muted-foreground">
              {stepDone
                ? "Étape complétée."
                : `${step.items.filter((i) => checked[i.key]).length}/${step.items.length} sur cette étape`}
            </p>
            {stepIndex < ONBOARDING_STEPS.length - 1 ? (
              <Button
                size="sm"
                variant={stepDone ? "default" : "outline"}
                onClick={() =>
                  setStepIndex((i) =>
                    Math.min(ONBOARDING_STEPS.length - 1, i + 1),
                  )
                }
              >
                Suivant
                <ArrowRight />
              </Button>
            ) : (
              <Button
                size="sm"
                variant={progress.complete ? "default" : "outline"}
                render={<Link href={`/clients/${clientId}`} />}
              >
                Retour au projet
              </Button>
            )}
          </div>
        </motion.section>
      </div>
    </div>
  );
}
