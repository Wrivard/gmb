"use client";

// Création manuelle d'un projet (nouveau mandat signé). Volontairement
// minimal : le strict nécessaire pour démarrer l'onboarding — la fiche
// Google complètera le reste à la découverte, le profil de marque se
// raffine dans Réglages.

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GBP_CATEGORY_SUGGESTIONS } from "@/lib/gbp/categories";
import { createClientAction } from "../actions";

export function NewClientForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    name: "",
    category: "",
    city: "",
    address: "",
    phone: "",
    website: "",
  });

  const set =
    (key: keyof typeof form) =>
    (event: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [key]: event.target.value }));

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await createClientAction(form);
      if (result.ok && result.clientId) {
        toast.success(
          `${form.name.trim()} créé — place à l'optimisation de la fiche.`,
        );
        router.push(`/clients/${result.clientId}/onboarding`);
        router.refresh();
      } else if (!result.ok) {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" render={<Link href="/clients" />}>
          <ArrowLeft />
          Projets
        </Button>
        <h1 className="text-xl font-semibold tracking-tight">
          Nouveau projet
        </h1>
      </div>

      <form
        onSubmit={submit}
        className="flex flex-col gap-4 rounded-lg border border-border bg-elevated p-5"
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="np-name">
            Nom de l&apos;entreprise{" "}
            <span className="text-destructive">*</span>
          </Label>
          <Input
            id="np-name"
            value={form.name}
            onChange={set("name")}
            placeholder="Toitures Bergeron"
            autoFocus
            required
            disabled={pending}
          />
          <p className="text-xs text-muted-foreground">
            Le nom EXACT, tel qu&apos;il doit apparaître sur Google — sans
            mots-clés ajoutés.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="np-category">Métier / catégorie</Label>
            <datalist id="gbp-categories-new">
              {GBP_CATEGORY_SUGGESTIONS.map((category) => (
                <option key={category} value={category} />
              ))}
            </datalist>
            <Input
              id="np-category"
              list="gbp-categories-new"
              value={form.category}
              onChange={set("category")}
              placeholder="Couvreur"
              disabled={pending}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="np-city">Ville</Label>
            <Input
              id="np-city"
              value={form.city}
              onChange={set("city")}
              placeholder="Sainte-Thérèse"
              disabled={pending}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="np-address">Adresse</Label>
          <Input
            id="np-address"
            value={form.address}
            onChange={set("address")}
            placeholder="450 rue Blainville Ouest, Sainte-Thérèse, QC"
            disabled={pending}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="np-phone">Téléphone</Label>
            <Input
              id="np-phone"
              type="tel"
              value={form.phone}
              onChange={set("phone")}
              placeholder="450-555-0123"
              disabled={pending}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="np-website">Site web</Label>
            <Input
              id="np-website"
              type="url"
              value={form.website}
              onChange={set("website")}
              placeholder="https://…"
              disabled={pending}
            />
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border pt-4">
          <p className="text-xs text-muted-foreground">
            Le projet naît en pause — il s&apos;active une fois la fiche
            optimisée.
          </p>
          <Button type="submit" disabled={pending || !form.name.trim()}>
            {pending ? "Création…" : "Créer et optimiser"}
            <ArrowRight />
          </Button>
        </div>
      </form>
    </div>
  );
}
