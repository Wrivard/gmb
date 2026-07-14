"use client";

// Wizard d'optimisation de la fiche GBP — v2 : on SAISIT les données de
// la fiche ici (elles vivent dans l'app) et on les POUSSE vers Google
// via le même tuyau que les posts (mock tant que l'accès API n'est pas
// approuvé). v3 : plus de boutons par étape — l'enregistrement est
// automatique (débounce) et UN bouton global pousse toutes les sections
// en retard. Le score se calcule sur les données réelles.

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleDashed,
  CloudUpload,
  ExternalLink,
  ImagePlus,
  PartyPopper,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { GBP_CATEGORY_SUGGESTIONS } from "@/lib/gbp/categories";
import {
  isRequirementMet,
  ONBOARDING_STEPS,
  onboardingProgress,
  PUSHABLE_SECTIONS,
  WEEKDAYS,
  type OnboardingCtx,
  type PushSection,
  type Requirement,
} from "@/lib/onboarding/steps";
import type {
  ClientStatus,
  GbpDayHours,
  GbpPhoto,
  GbpPhotoRole,
  GbpProfileData,
  GbpWeekday,
  OnboardingItemState,
} from "@/lib/types/database";
import {
  deleteGbpPhotoAction,
  pushGbpSectionAction,
  saveGbpProfileAction,
  setOnboardingItemAction,
  uploadGbpPhotoAction,
} from "../actions";
import { toggleClientActiveAction } from "@/app/(app)/settings/actions";

/* ── Découpage de gbp_profile en sections sauvegardables ──────────── */

type SectionKey =
  | "categories"
  | "identity"
  | "hours"
  | "presentation"
  | "services"
  | "qna";

const SECTION_KEYS: SectionKey[] = [
  "categories",
  "identity",
  "hours",
  "presentation",
  "services",
  "qna",
];

function sectionPatch(
  profile: GbpProfileData,
  section: SectionKey,
): Partial<GbpProfileData> {
  switch (section) {
    case "categories":
      return { categories: profile.categories };
    case "identity":
      return { identity: profile.identity };
    case "hours":
      return { hours: profile.hours };
    case "presentation":
      return {
        description: profile.description,
        opening_date: profile.opening_date,
      };
    case "services":
      return { services: profile.services };
    case "qna":
      return { qna: profile.qna };
  }
}

function sectionEquals(
  a: GbpProfileData,
  b: GbpProfileData,
  section: SectionKey,
): boolean {
  return (
    JSON.stringify(sectionPatch(a, section)) ===
    JSON.stringify(sectionPatch(b, section))
  );
}

/** Une section a-t-elle de quoi être poussée ? (miroir des gardes du
    buildLocationPatch serveur — évite de pousser du vide). */
function sectionHasData(profile: GbpProfileData, section: PushSection): boolean {
  switch (section) {
    case "identity":
      return Boolean(profile.identity?.name?.trim());
    case "hours":
      return WEEKDAYS.some((d) => (profile.hours ?? {})[d.key] !== undefined);
    case "presentation":
      return Boolean(profile.description?.trim() || profile.opening_date);
    case "services":
      return (profile.services ?? []).some((s) => s.name?.trim());
  }
}

const SECTION_LABELS: Record<PushSection, string> = {
  identity: "Coordonnées",
  hours: "Heures",
  presentation: "Présentation",
  services: "Services",
};

/** Sections éditées par chaque étape (identity édite aussi les heures). */
const STEP_SECTIONS: Record<string, SectionKey[]> = {
  categories: ["categories"],
  identity: ["identity", "hours"],
  services: ["services"],
  presentation: ["presentation"],
  lancement: ["qna"],
};

/** Note d'étape pour les sections pas encore pushables par API. */
const STEP_API_NOTES: Record<string, string> = {
  categories:
    "Push des catégories à l'approbation API (il exige le référentiel officiel de Google) — applique-les sur la fiche en attendant.",
  lancement:
    "Push des Q&R à venir (API dédiée) — copie-colle sur la fiche en attendant.",
  photos:
    "Push des photos à l'approbation API (API média) — pose-les sur la fiche en attendant, elles restent archivées ici.",
};

const AUTOSAVE_DELAY_MS = 900;

export function OnboardingWizard({
  clientId,
  clientName,
  clientStatus,
  initialProfile,
  initialChecks,
  brandProfileComplete,
}: {
  clientId: string;
  clientName: string;
  clientStatus: ClientStatus;
  initialProfile: GbpProfileData;
  initialChecks: Record<string, OnboardingItemState>;
  brandProfileComplete: boolean;
}) {
  const router = useRouter();
  const [profile, setProfile] = useState<GbpProfileData>(initialProfile);
  const [saved, setSaved] = useState<GbpProfileData>(initialProfile);
  const [checks, setChecks] =
    useState<Record<string, OnboardingItemState>>(initialChecks);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const saveInFlight = useRef(false);
  const [pushing, startPush] = useTransition();
  const [activating, startActivate] = useTransition();

  const ctx: OnboardingCtx = useMemo(
    () => ({ profile: saved, checks, brandProfileComplete }),
    [saved, checks, brandProfileComplete],
  );
  const progress = useMemo(() => onboardingProgress(ctx), [ctx]);

  const hasUnsaved = SECTION_KEYS.some(
    (section) => !sectionEquals(profile, saved, section),
  );

  // Enregistrement automatique : toute saisie part au serveur après une
  // pause. Silencieux (l'indicateur suffit) — toast en cas d'échec, et
  // la prochaine modification relancera la sauvegarde.
  useEffect(() => {
    const changed = SECTION_KEYS.filter(
      (section) => !sectionEquals(profile, saved, section),
    );
    if (!changed.length) return;
    const timer = setTimeout(() => {
      if (saveInFlight.current) return; // la fin du save en cours re-déclenchera
      const patch = changed.reduce(
        (acc, section) => ({ ...acc, ...sectionPatch(profile, section) }),
        {} as Partial<GbpProfileData>,
      );
      saveInFlight.current = true;
      setSaveState("saving");
      void saveGbpProfileAction(clientId, patch).then((result) => {
        saveInFlight.current = false;
        if (result.ok) {
          setSaveState("saved");
          setSaved((prev) => ({ ...prev, ...patch }));
          router.refresh();
        } else {
          setSaveState("idle");
          toast.error(result.error);
        }
      });
    }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [profile, saved, clientId, router]);

  // Sections à pousser : des données + jamais poussé ou modifié depuis.
  const pendingPush = PUSHABLE_SECTIONS.filter(
    (section) =>
      sectionHasData(saved, section) &&
      (!saved.sync?.[section] || saved.sync[section].dirty),
  );

  function pushAll() {
    startPush(async () => {
      const pushed: PushSection[] = [];
      let failure: string | null = null;
      for (const section of pendingPush) {
        const result = await pushGbpSectionAction(clientId, section);
        if (!result.ok) {
          // Même tuyau pour toutes les sections : la première erreur
          // (accès API en attente, fiche non liée…) vaut pour la suite.
          failure = result.error;
          break;
        }
        pushed.push(section);
      }
      if (pushed.length) {
        const stamp = { pushed_at: new Date().toISOString(), by: "toi" };
        const apply = (prev: GbpProfileData): GbpProfileData => ({
          ...prev,
          sync: {
            ...(prev.sync ?? {}),
            ...Object.fromEntries(pushed.map((s) => [s, stamp])),
          },
        });
        setProfile(apply);
        setSaved(apply);
      }
      if (failure) toast.error(failure);
      else
        toast.success(
          pushed.length > 1
            ? `${pushed.length} sections poussées sur la fiche Google.`
            : "Poussé sur la fiche Google.",
        );
      router.refresh();
    });
  }

  const [stepIndex, setStepIndex] = useState(() => {
    const initial = onboardingProgress({
      profile: initialProfile,
      checks: initialChecks,
      brandProfileComplete,
    });
    const index = ONBOARDING_STEPS.findIndex(
      (step) => !initial.doneSteps.has(step.key),
    );
    return index === -1 ? 0 : index;
  });
  const step = ONBOARDING_STEPS[stepIndex];
  const stepSections = STEP_SECTIONS[step.key] ?? [];
  const stepPushable = stepSections.filter((section): section is PushSection =>
    (PUSHABLE_SECTIONS as string[]).includes(section),
  );
  const stepSyncTexts = stepPushable
    .filter((section) => sectionHasData(saved, section))
    .map((section) => {
      const sync = saved.sync?.[section];
      if (!sync) return `${SECTION_LABELS[section]} : à pousser`;
      if (sync.dirty)
        return `${SECTION_LABELS[section]} : modifié depuis le push`;
      return `${SECTION_LABELS[section]} : poussé le ${new Date(
        sync.pushed_at,
      ).toLocaleDateString("fr-CA")}`;
    });

  function toggleCheck(key: string) {
    const next = !checks[key]?.done;
    setChecks((prev) => {
      const map = { ...prev };
      if (next) map[key] = { done: true };
      else delete map[key];
      return map;
    });
    void setOnboardingItemAction(clientId, key, next).then((result) => {
      if (!result.ok) {
        setChecks((prev) => {
          const map = { ...prev };
          if (next) delete map[key];
          else map[key] = { done: true };
          return map;
        });
        toast.error(result.error);
      } else {
        router.refresh();
      }
    });
  }

  function applyPhotos(photos: GbpPhoto[]) {
    // Les photos se sauvegardent via leurs propres actions — on aligne
    // les deux états locaux, hors du circuit d'auto-save.
    setProfile((prev) => ({ ...prev, photos }));
    setSaved((prev) => ({ ...prev, photos }));
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

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      {/* Suggestions de catégories GBP (datalist natif, saisie libre). */}
      <datalist id="gbp-categories">
        {GBP_CATEGORY_SUGGESTIONS.map((category) => (
          <option key={category} value={category} />
        ))}
      </datalist>

      {/* En-tête : contexte + progression + le SEUL bouton de push. */}
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
          <span
            className="text-xs text-muted-foreground"
            aria-live="polite"
          >
            {saveState === "saving" || hasUnsaved
              ? "Enregistrement…"
              : saveState === "saved"
                ? "Enregistré ✓"
                : null}
          </span>
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
          <Button
            size="sm"
            variant={pendingPush.length ? "default" : "outline"}
            onClick={pushAll}
            disabled={
              pushing ||
              pendingPush.length === 0 ||
              hasUnsaved ||
              saveState === "saving"
            }
            title={
              hasUnsaved || saveState === "saving"
                ? "L'enregistrement se termine…"
                : pendingPush.length === 0
                  ? "Tout est déjà sur la fiche Google."
                  : undefined
            }
          >
            <CloudUpload />
            {pushing
              ? "Push…"
              : pendingPush.length
                ? `Pousser sur Google (${pendingPush.length})`
                : "Pousser sur Google"}
          </Button>
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
              const doneCount = entry.requirements.filter((req) =>
                isRequirementMet(req, ctx),
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
                  {!done && doneCount > 0 && (
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {doneCount}/{entry.requirements.length}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
          <a
            href="https://business.google.com/locations"
            target="_blank"
            rel="noreferrer"
            className="hidden items-center gap-1.5 border-t border-border px-3 pt-3 text-xs text-muted-foreground transition-colors hover:text-foreground md:flex"
          >
            <ExternalLink className="size-3" />
            Ouvrir Google Business Profile
          </a>
        </div>

        {/* Panneau de l'étape courante */}
        <motion.section
          key={step.key}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="rounded-lg border border-border bg-elevated p-5"
        >
          <div className="mb-5">
            <h2 className="text-base font-semibold tracking-tight">
              {stepIndex + 1}. {step.title}
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">{step.why}</p>
          </div>

          {/* Éditeur de l'étape */}
          {step.key === "categories" && (
            <CategoriesEditor profile={profile} onChange={setProfile} />
          )}
          {step.key === "identity" && (
            <IdentityEditor profile={profile} onChange={setProfile} />
          )}
          {step.key === "services" && (
            <ServicesEditor profile={profile} onChange={setProfile} />
          )}
          {step.key === "presentation" && (
            <PresentationEditor profile={profile} onChange={setProfile} />
          )}
          {step.key === "photos" && (
            <PhotosEditor
              clientId={clientId}
              profile={profile}
              onPhotos={applyPhotos}
            />
          )}
          {step.key === "lancement" && (
            <QnaEditor profile={profile} onChange={setProfile} />
          )}

          {/* État de sync (le push se fait par le bouton global). */}
          {(stepSyncTexts.length > 0 || STEP_API_NOTES[step.key]) && (
            <p className="mt-4 text-xs text-muted-foreground">
              {[...stepSyncTexts, STEP_API_NOTES[step.key]]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}

          {/* Critères de l'étape */}
          <div className="mt-5 border-t border-border pt-4">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Critères pour compléter l&apos;étape
            </p>
            <ul className="flex flex-col gap-2">
              {step.requirements.map((req) => (
                <RequirementRow
                  key={req.key}
                  requirement={req}
                  met={isRequirementMet(req, ctx)}
                  clientId={clientId}
                  onToggle={() => toggleCheck(req.key)}
                />
              ))}
            </ul>
          </div>

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
            {stepIndex < ONBOARDING_STEPS.length - 1 ? (
              <Button
                size="sm"
                variant={
                  progress.doneSteps.has(step.key) ? "default" : "outline"
                }
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

/* ── Critères ─────────────────────────────────────────────────────── */

function RequirementRow({
  requirement,
  met,
  clientId,
  onToggle,
}: {
  requirement: Requirement;
  met: boolean;
  clientId: string;
  onToggle: () => void;
}) {
  return (
    <li className="flex items-start gap-2.5">
      {requirement.manual ? (
        <Checkbox
          checked={met}
          onCheckedChange={onToggle}
          className="mt-0.5"
          aria-label={requirement.label}
        />
      ) : met ? (
        <Check className="mt-0.5 size-4 shrink-0 text-success" />
      ) : (
        <CircleDashed className="mt-0.5 size-4 shrink-0 text-muted-foreground/60" />
      )}
      <span className="min-w-0">
        <span
          className={cn(
            "block text-sm",
            met && "text-muted-foreground line-through",
          )}
        >
          {requirement.label}
        </span>
        {requirement.hint && (
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {requirement.hint}
          </span>
        )}
      </span>
      {requirement.appTab && (
        <Link
          href={`/clients/${clientId}?tab=${requirement.appTab}`}
          className="ml-auto shrink-0 self-center text-xs font-medium text-primary underline-offset-2 hover:underline"
        >
          Ouvrir →
        </Link>
      )}
    </li>
  );
}

/* ── Éditeurs par étape ───────────────────────────────────────────── */

type EditorProps = {
  profile: GbpProfileData;
  onChange: React.Dispatch<React.SetStateAction<GbpProfileData>>;
};

function CategoriesEditor({ profile, onChange }: EditorProps) {
  const categories = profile.categories ?? {};
  const additional = categories.additional ?? [];
  const [draft, setDraft] = useState("");

  function addSecondary() {
    const value = draft.trim();
    setDraft("");
    if (!value || additional.includes(value)) return;
    onChange((prev) => ({
      ...prev,
      categories: {
        ...(prev.categories ?? {}),
        additional: [...(prev.categories?.additional ?? []), value],
      },
    }));
  }

  function removeSecondary(value: string) {
    onChange((prev) => ({
      ...prev,
      categories: {
        ...(prev.categories ?? {}),
        additional: (prev.categories?.additional ?? []).filter(
          (c) => c !== value,
        ),
      },
    }));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cat-primary">Catégorie principale</Label>
        <Input
          id="cat-primary"
          list="gbp-categories"
          value={categories.primary ?? ""}
          onChange={(e) =>
            onChange((prev) => ({
              ...prev,
              categories: {
                ...(prev.categories ?? {}),
                primary: e.target.value,
              },
            }))
          }
          placeholder="Couvreur"
          className="max-w-sm"
        />
        <p className="text-xs text-muted-foreground">
          Suggestions en tapant — vise le nom EXACT d&apos;une catégorie
          Google (vérifie sur la fiche au besoin, le référentiel officiel
          arrive avec l&apos;API).
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cat-additional">Catégories secondaires</Label>
        {additional.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {additional.map((category) => (
              <Badge
                key={category}
                variant="secondary"
                className="gap-1 pr-1"
              >
                {category}
                <button
                  type="button"
                  aria-label={`Retirer ${category}`}
                  className="rounded-full p-0.5 transition-colors hover:bg-muted-foreground/20"
                  onClick={() => removeSecondary(category)}
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
        <div className="flex max-w-sm items-center gap-2">
          <Input
            id="cat-additional"
            list="gbp-categories"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addSecondary();
              }
            }}
            placeholder="Entrepreneur en toiture"
          />
          <Button
            size="sm"
            variant="outline"
            className="shrink-0"
            onClick={addSecondary}
            disabled={!draft.trim()}
          >
            <Plus />
            Ajouter
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Lun-ven 8 h à 17 h, fin de semaine fermé — le point de départ à ajuster. */
const TYPICAL_WEEK: GbpProfileData["hours"] = {
  monday: { open: "08:00", close: "17:00" },
  tuesday: { open: "08:00", close: "17:00" },
  wednesday: { open: "08:00", close: "17:00" },
  thursday: { open: "08:00", close: "17:00" },
  friday: { open: "08:00", close: "17:00" },
  saturday: null,
  sunday: null,
};

function IdentityEditor({ profile, onChange }: EditorProps) {
  const identity = profile.identity ?? {};
  const hours = profile.hours ?? {};

  const setIdentity = (key: keyof NonNullable<GbpProfileData["identity"]>) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      onChange((prev) => ({
        ...prev,
        identity: { ...(prev.identity ?? {}), [key]: e.target.value },
      }));

  function setDay(day: GbpWeekday, value: GbpDayHours | null | undefined) {
    onChange((prev) => {
      const next = { ...(prev.hours ?? {}) };
      if (value === undefined) delete next[day];
      else next[day] = value;
      return { ...prev, hours: next };
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="id-name">Nom exact</Label>
          <Input
            id="id-name"
            value={identity.name ?? ""}
            onChange={setIdentity("name")}
            placeholder="Toitures Bergeron"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="id-phone">Téléphone local</Label>
          <Input
            id="id-phone"
            type="tel"
            value={identity.phone ?? ""}
            onChange={setIdentity("phone")}
            placeholder="450-555-0123"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="id-website">Site web</Label>
          <Input
            id="id-website"
            type="url"
            value={identity.website ?? ""}
            onChange={setIdentity("website")}
            placeholder="https://…"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="id-address">Adresse</Label>
          <Input
            id="id-address"
            value={identity.address ?? ""}
            onChange={setIdentity("address")}
            placeholder="450 rue Blainville O., Sainte-Thérèse"
          />
          <p className="text-xs text-muted-foreground">
            L&apos;adresse ne se pousse pas par API (elle déclencherait une
            re-vérification) — modifie-la sur la fiche au besoin.
          </p>
        </div>
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium">Heures d&apos;ouverture</p>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs text-muted-foreground"
            onClick={() =>
              onChange((prev) => ({ ...prev, hours: { ...TYPICAL_WEEK } }))
            }
          >
            Semaine type (lun.–ven. 8 h à 17 h)
          </Button>
        </div>
        <div className="flex flex-col gap-1.5">
          {WEEKDAYS.map((day) => {
            const value = hours[day.key];
            const state =
              value === undefined ? "unset" : value === null ? "closed" : "open";
            return (
              <div key={day.key} className="flex items-center gap-2 text-sm">
                <span className="w-24 text-muted-foreground">{day.label}</span>
                <select
                  value={state}
                  onChange={(e) => {
                    const next = e.target.value;
                    if (next === "closed") setDay(day.key, null);
                    else if (next === "open")
                      setDay(
                        day.key,
                        value ?? { open: "08:00", close: "17:00" },
                      );
                    else setDay(day.key, undefined);
                  }}
                  className="h-7 rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50 dark:bg-input/30"
                  aria-label={`Statut du ${day.label}`}
                >
                  <option value="unset">—</option>
                  <option value="open">Ouvert</option>
                  <option value="closed">Fermé</option>
                </select>
                {state === "open" && value && (
                  <>
                    <Input
                      type="time"
                      value={value.open}
                      onChange={(e) =>
                        setDay(day.key, { ...value, open: e.target.value })
                      }
                      className="h-7 w-28 text-xs tabular-nums"
                      aria-label={`Ouverture ${day.label}`}
                    />
                    <span className="text-muted-foreground">–</span>
                    <Input
                      type="time"
                      value={value.close}
                      onChange={(e) =>
                        setDay(day.key, { ...value, close: e.target.value })
                      }
                      className="h-7 w-28 text-xs tabular-nums"
                      aria-label={`Fermeture ${day.label}`}
                    />
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ServicesEditor({ profile, onChange }: EditorProps) {
  const services = profile.services ?? [];

  function update(
    index: number,
    patch: Partial<{ name: string; description: string }>,
  ) {
    onChange((prev) => {
      const list = [...(prev.services ?? [])];
      list[index] = { ...list[index], ...patch };
      return { ...prev, services: list };
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {services.map((service, index) => (
        <div
          key={index}
          className="flex flex-col gap-2 rounded-md border border-border bg-background p-3"
        >
          <div className="flex items-center gap-2">
            <Input
              value={service.name}
              onChange={(e) => update(index, { name: e.target.value })}
              placeholder="Réfection de toiture"
              aria-label={`Nom du service ${index + 1}`}
            />
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Retirer ce service"
              className="shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() =>
                onChange((prev) => ({
                  ...prev,
                  services: (prev.services ?? []).filter(
                    (_, i) => i !== index,
                  ),
                }))
              }
            >
              <Trash2 />
            </Button>
          </div>
          <Textarea
            value={service.description ?? ""}
            onChange={(e) => update(index, { description: e.target.value })}
            rows={2}
            placeholder="2-3 phrases concrètes sur ce service…"
            className="text-sm"
            aria-label={`Description du service ${index + 1}`}
          />
        </div>
      ))}
      <Button
        size="sm"
        variant="outline"
        className="self-start"
        onClick={() =>
          onChange((prev) => ({
            ...prev,
            services: [...(prev.services ?? []), { name: "" }],
          }))
        }
      >
        <Plus />
        Ajouter un service
      </Button>
    </div>
  );
}

function PresentationEditor({ profile, onChange }: EditorProps) {
  const length = profile.description?.length ?? 0;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pres-desc">Description de l&apos;entreprise</Label>
        <Textarea
          id="pres-desc"
          value={profile.description ?? ""}
          onChange={(e) =>
            onChange((prev) => ({ ...prev, description: e.target.value }))
          }
          rows={6}
          maxLength={750}
          placeholder="Ce qui rend l'entreprise unique, ses services clés, sa zone — l'essentiel dans les 250 premiers caractères…"
          className="text-sm"
        />
        <p
          className={cn(
            "text-xs tabular-nums",
            length >= 250 ? "text-muted-foreground" : "text-warning",
          )}
        >
          {length}/750 {length < 250 && "— vise au moins 250 caractères"}
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pres-open">Date d&apos;ouverture</Label>
        <Input
          id="pres-open"
          type="month"
          value={profile.opening_date ?? ""}
          onChange={(e) =>
            onChange((prev) => ({ ...prev, opening_date: e.target.value }))
          }
          className="w-44 tabular-nums"
        />
      </div>
    </div>
  );
}

/* ── Photos ───────────────────────────────────────────────────────── */

const COMPRESS_THRESHOLD_BYTES = 1_500_000;
const COMPRESS_MAX_DIMENSION = 1920;

/** Réduit les photos lourdes côté navigateur (limite server action 4 Mo).
    GBP ne demande que 720 px — 1920 px garde une marge confortable. */
async function compressImage(file: File): Promise<Blob> {
  if (file.size < COMPRESS_THRESHOLD_BYTES) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(
      1,
      COMPRESS_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85),
    );
    return blob ?? file;
  } catch {
    return file; // Format non décodable (HEIC…) — le serveur tranchera.
  }
}

function PhotosEditor({
  clientId,
  profile,
  onPhotos,
}: {
  clientId: string;
  profile: GbpProfileData;
  onPhotos: (photos: GbpPhoto[]) => void;
}) {
  const photos = profile.photos ?? [];
  const logo = photos.find((p) => p.role === "logo");
  const cover = photos.find((p) => p.role === "cover");
  const gallery = photos.filter((p) => p.role === "photo");
  const [busy, setBusy] = useState<string | null>(null);

  async function upload(role: GbpPhotoRole, files: FileList | null) {
    if (!files?.length || busy) return;
    const list = role === "photo" ? Array.from(files) : [files[0]];
    for (let i = 0; i < list.length; i++) {
      setBusy(
        list.length > 1
          ? `Téléversement ${i + 1}/${list.length}…`
          : "Téléversement…",
      );
      const image = await compressImage(list[i]);
      const data = new FormData();
      data.set("file", image, list[i].name || "photo.jpg");
      const result = await uploadGbpPhotoAction(clientId, role, data);
      if (!result.ok) {
        toast.error(result.error);
        break;
      }
      onPhotos(result.photos);
    }
    setBusy(null);
  }

  async function remove(path: string) {
    const result = await deleteGbpPhotoAction(clientId, path);
    if (result.ok) onPhotos(result.photos);
    else toast.error(result.error);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-3">
        <PhotoSlot
          label="Logo"
          hint="carré, fond propre"
          photo={logo}
          disabled={Boolean(busy)}
          onFile={(files) => upload("logo", files)}
        />
        <PhotoSlot
          label="Photo de couverture"
          hint="la meilleure photo réelle"
          photo={cover}
          disabled={Boolean(busy)}
          onFile={(files) => upload("cover", files)}
          wide
        />
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Galerie</p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {gallery.map((photo) => (
            <div
              key={photo.path}
              className="group relative aspect-[4/3] overflow-hidden rounded-md border border-border"
            >
              <Image
                src={photo.url}
                alt="Photo de la fiche"
                fill
                sizes="200px"
                className="object-cover"
              />
              <button
                type="button"
                aria-label="Supprimer cette photo"
                onClick={() => remove(photo.path)}
                className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
          <label
            className={cn(
              "flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border text-xs text-muted-foreground transition-colors hover:border-ring/60 hover:text-foreground",
              busy && "pointer-events-none opacity-60",
            )}
          >
            <input
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(e) => {
                void upload("photo", e.target.files);
                e.target.value = "";
              }}
            />
            <ImagePlus className="size-4" />
            Ajouter
          </label>
        </div>
        <p className="text-xs tabular-nums text-muted-foreground">
          {busy ??
            `${gallery.length}/10 photos${
              gallery.length < 10 ? " — vise le lot initial complet" : ""
            }`}
        </p>
      </div>
    </div>
  );
}

function PhotoSlot({
  label,
  hint,
  photo,
  disabled,
  onFile,
  wide,
}: {
  label: string;
  hint: string;
  photo: GbpPhoto | undefined;
  disabled: boolean;
  onFile: (files: FileList | null) => void;
  wide?: boolean;
}) {
  return (
    <label
      className={cn(
        "group relative flex cursor-pointer flex-col items-center justify-center overflow-hidden rounded-md border border-dashed border-border bg-background text-center transition-colors hover:border-ring/60",
        wide ? "h-32 min-w-52 flex-1" : "size-32 shrink-0",
        disabled && "pointer-events-none opacity-60",
      )}
    >
      <input
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          onFile(e.target.files);
          e.target.value = "";
        }}
      />
      {photo ? (
        <>
          <Image
            src={photo.url}
            alt={label}
            fill
            sizes="400px"
            className="object-cover"
          />
          <span className="absolute inset-x-0 bottom-0 bg-black/55 px-2 py-1 text-[11px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
            Remplacer
          </span>
        </>
      ) : (
        <span className="flex flex-col items-center gap-1 px-3 text-xs text-muted-foreground">
          <ImagePlus className="size-4" />
          <span className="font-medium text-foreground">{label}</span>
          <span>{hint}</span>
        </span>
      )}
    </label>
  );
}

function QnaEditor({ profile, onChange }: EditorProps) {
  const qna = profile.qna ?? [];

  function update(
    index: number,
    patch: Partial<{ question: string; answer: string }>,
  ) {
    onChange((prev) => {
      const list = [...(prev.qna ?? [])];
      list[index] = { ...list[index], ...patch };
      return { ...prev, qna: list };
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium">Questions &amp; réponses</p>
      {qna.map((pair, index) => (
        <div
          key={index}
          className="flex flex-col gap-2 rounded-md border border-border bg-background p-3"
        >
          <div className="flex items-center gap-2">
            <Input
              value={pair.question}
              onChange={(e) => update(index, { question: e.target.value })}
              placeholder="Offrez-vous des soumissions gratuites ?"
              aria-label={`Question ${index + 1}`}
            />
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Retirer cette question"
              className="shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() =>
                onChange((prev) => ({
                  ...prev,
                  qna: (prev.qna ?? []).filter((_, i) => i !== index),
                }))
              }
            >
              <Trash2 />
            </Button>
          </div>
          <Textarea
            value={pair.answer}
            onChange={(e) => update(index, { answer: e.target.value })}
            rows={2}
            placeholder="Oui — réponse sous 48 h, sans engagement…"
            className="text-sm"
            aria-label={`Réponse ${index + 1}`}
          />
        </div>
      ))}
      <Button
        size="sm"
        variant="outline"
        className="self-start"
        onClick={() =>
          onChange((prev) => ({
            ...prev,
            qna: [...(prev.qna ?? []), { question: "", answer: "" }],
          }))
        }
      >
        <Plus />
        Ajouter une question
      </Button>
    </div>
  );
}
