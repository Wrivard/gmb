"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { BrandProfile, Client } from "@/lib/types/database";
import {
  updateBrandProfileAction,
  updateClientSettingsAction,
} from "./actions";

function listToText(items: string[] | undefined): string {
  return items?.join(", ") ?? "";
}

function textToList(text: string): string[] | undefined {
  const items = text
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length ? items : undefined;
}

type ClientSettingsClient = Pick<
  Client,
  | "id"
  | "posts_per_month"
  | "language"
  | "auto_publish_replies"
  | "auto_publish_posts"
  | "status"
  | "brand_profile"
>;

export function ClientSettings({
  client,
  readOnly = false,
}: {
  client: ClientSettingsClient;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const profile: BrandProfile = client.brand_profile ?? {};

  // Réglages de publication
  const [postsPerMonth, setPostsPerMonth] = useState(
    String(client.posts_per_month),
  );
  const [language, setLanguage] = useState(client.language);
  const [autoReplies, setAutoReplies] = useState(client.auto_publish_replies);
  const [autoPosts, setAutoPosts] = useState(client.auto_publish_posts);
  const [active, setActive] = useState(client.status === "active");
  const [savingSettings, startSettings] = useTransition();

  // Brand profile
  const [tone, setTone] = useState(profile.tone ?? "");
  const [vertical, setVertical] = useState(profile.vertical ?? "");
  const [city, setCity] = useState(profile.city ?? "");
  const [services, setServices] = useState(listToText(profile.services_cles));
  const [args, setArgs] = useState(listToText(profile.arguments));
  const [signature, setSignature] = useState(profile.signature ?? "");
  const [avoid, setAvoid] = useState(listToText(profile.a_eviter));
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [notes, setNotes] = useState(profile.notes ?? "");
  const [savingProfile, startProfile] = useTransition();

  function saveSettings() {
    // Champ vidé ou hors bornes : Number("") vaut 0 et couperait la
    // cadence en silence — on bloque avant l'envoi.
    const cadence = Number(postsPerMonth);
    if (postsPerMonth.trim() === "" || !Number.isInteger(cadence) || cadence < 0 || cadence > 10) {
      toast.error("Posts par mois doit être un entier entre 0 et 10.");
      return;
    }
    startSettings(async () => {
      const result = await updateClientSettingsAction(client.id, {
        postsPerMonth: cadence,
        language,
        autoPublishReplies: autoReplies,
        autoPublishPosts: autoPosts,
        active,
      });
      if (result.ok) {
        toast.success("Réglages enregistrés.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function saveProfile() {
    startProfile(async () => {
      const result = await updateBrandProfileAction(client.id, {
        tone: tone.trim() || undefined,
        vertical: vertical.trim() || undefined,
        city: city.trim() || undefined,
        services_cles: textToList(services),
        arguments: textToList(args),
        signature: signature.trim() || undefined,
        a_eviter: textToList(avoid),
        phone: phone.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      if (result.ok) {
        toast.success("Profil de marque enregistré.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      {/* Publication */}
      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-medium">Publication</h3>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="posts-per-month">Posts par mois</Label>
            <Input
              id="posts-per-month"
              type="number"
              disabled={readOnly}
              min={0}
              max={10}
              value={postsPerMonth}
              onChange={(event) => setPostsPerMonth(event.target.value)}
              className="w-24"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Langue</Label>
            <Select
              disabled={readOnly}
              value={language}
              onValueChange={(value) => setLanguage(value as string)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fr-CA">Français (fr-CA)</SelectItem>
                <SelectItem value="en-CA">Anglais (en-CA)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-border bg-elevated p-3">
          <div className="flex items-center gap-3">
            <Switch
              checked={autoReplies}
              onCheckedChange={(checked) => setAutoReplies(Boolean(checked))}
              aria-label="Auto-publication des réponses"
              disabled={readOnly}
            />
            <div className="text-sm">
              Auto-publier les réponses aux reviews 4–5★
              <p className="text-xs text-muted-foreground">
                ⚠️ Les brouillons partent sans validation humaine. Les reviews ≤ 3★
                exigent toujours une approbation.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch
              checked={autoPosts}
              onCheckedChange={(checked) => setAutoPosts(Boolean(checked))}
              aria-label="Auto-publication des posts"
              disabled={readOnly}
            />
            <div className="text-sm">
              Auto-planifier les posts générés
              <p className="text-xs text-muted-foreground">
                ⚠️ Les posts générés passent directement en « planifié » sans
                approbation.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch
              checked={active}
              onCheckedChange={(checked) => setActive(Boolean(checked))}
              aria-label="Client actif"
              disabled={readOnly}
            />
            <div className="text-sm">
              Client actif
              <p className="text-xs text-muted-foreground">
                Un client en pause n&apos;apparaît pas dans le kanban et
                n&apos;est pas synchronisé.
              </p>
            </div>
          </div>
        </div>

        {!readOnly && (
          <Button
            size="sm"
            className="self-start"
            onClick={saveSettings}
            disabled={savingSettings}
          >
            {savingSettings ? "Enregistrement…" : "Enregistrer les réglages"}
          </Button>
        )}
      </section>

      {/* Brand profile */}
      <section className="flex flex-col gap-4">
        <div>
          <h3 className="text-sm font-medium">Profil de marque</h3>
          <p className="text-xs text-muted-foreground">
            Nourrit tous les prompts AI (réponses et posts). Plus il est
            riche, meilleurs sont les drafts.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bp-tone">Ton</Label>
            <Input
              id="bp-tone"
              disabled={readOnly}
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              placeholder="chaleureux et professionnel"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bp-vertical">Métier</Label>
            <Input
              id="bp-vertical"
              disabled={readOnly}
              value={vertical}
              onChange={(e) => setVertical(e.target.value)}
              placeholder="toiture"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bp-city">Ville</Label>
            <Input
              id="bp-city"
              disabled={readOnly}
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Laval"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bp-phone">Téléphone</Label>
            <Input
              id="bp-phone"
              disabled={readOnly}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="450-555-0123"
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="bp-services">Services clés (séparés par des virgules)</Label>
            <Input
              id="bp-services"
              disabled={readOnly}
              value={services}
              onChange={(e) => setServices(e.target.value)}
              placeholder="réfection de toiture, bardeaux d'asphalte"
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="bp-args">Arguments (séparés par des virgules)</Label>
            <Input
              id="bp-args"
              disabled={readOnly}
              value={args}
              onChange={(e) => setArgs(e.target.value)}
              placeholder="garantie 10 ans, soumission gratuite"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bp-signature">Signature</Label>
            <Input
              id="bp-signature"
              disabled={readOnly}
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              placeholder="L'équipe Toitures Bergeron"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bp-avoid">À éviter (séparés par des virgules)</Label>
            <Input
              id="bp-avoid"
              disabled={readOnly}
              value={avoid}
              onChange={(e) => setAvoid(e.target.value)}
              placeholder="prix précis, promesses de délai"
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="bp-notes">Notes</Label>
            <Textarea
              id="bp-notes"
              disabled={readOnly}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Entreprise familiale, 2e génération. Insister sur la fiabilité."
            />
          </div>
        </div>
        {!readOnly && (
          <Button
            size="sm"
            className="self-start"
            onClick={saveProfile}
            disabled={savingProfile}
          >
            {savingProfile ? "Enregistrement…" : "Enregistrer le profil"}
          </Button>
        )}
      </section>
    </div>
  );
}
