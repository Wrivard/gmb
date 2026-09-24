"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2, Save, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { GbpAttributeMeta, GbpAttributeValue } from "@/lib/gbp/types";
import {
  loadGbpAttributesAction,
  saveGbpAttributesAction,
} from "../actions";

// Attributs de la fiche, modifiables depuis le wizard.
//
// Avant : trois critères pesant 5 points — attributs d'identité,
// attributs de service, liens sociaux — n'étaient que des cases à
// cocher renvoyant vers l'interface de Google. Une case cochée ne
// change rien à la fiche ; ici, on écrit vraiment.
//
// Le catalogue dépend de la CATÉGORIE : un couvreur et une agence
// marketing n'ont pas les mêmes attributs. On affiche les libellés de
// Google plutôt que les nôtres. Le chargement se fait à l'ouverture de
// l'étape — ce composant n'est monté que là, donc les autres étapes ne
// paient rien.

type BoolState = Record<string, boolean>;
type UrlState = Record<string, string>;

function groupOf(meta: GbpAttributeMeta): string {
  return meta.groupDisplayName ?? "Autres";
}

export function AttributesEditor({ clientId }: { clientId: string }) {
  const [catalog, setCatalog] = useState<GbpAttributeMeta[] | null>(null);
  const [bools, setBools] = useState<BoolState>({});
  const [urls, setUrls] = useState<UrlState>({});
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [loading, startLoad] = useTransition();
  const [saving, startSave] = useTransition();
  const [failed, setFailed] = useState(false);
  const requested = useRef(false);

  const touch = (name: string) =>
    setDirty((current) => new Set(current).add(name));

  const load = () =>
    startLoad(async () => {
      setFailed(false);
      const result = await loadGbpAttributesAction(clientId);
      if (!result.ok) {
        setFailed(true);
        toast.error(result.error);
        return;
      }
      const nextBools: BoolState = {};
      const nextUrls: UrlState = {};
      for (const value of result.current ?? []) {
        if (value.values?.length) nextBools[value.name] = value.values[0];
        if (value.uriValues?.length) {
          nextUrls[value.name] = value.uriValues[0].uri;
        }
      }
      setBools(nextBools);
      setUrls(nextUrls);
      setDirty(new Set());
      // On ne propose que ce qu'on sait écrire : les ENUM et listes
      // d'enum demandent une UI dédiée, et mal les écrire effacerait
      // des valeurs posées à la main sur la fiche.
      setCatalog(
        (result.catalog ?? []).filter(
          (meta) => meta.valueType === "BOOL" || meta.valueType === "URL",
        ),
      );
    });

  const save = () =>
    startSave(async () => {
      const payload: GbpAttributeValue[] = [];
      for (const name of dirty) {
        const meta = catalog?.find((entry) => entry.name === name);
        if (!meta) continue;
        if (meta.valueType === "BOOL") {
          payload.push({ name, values: [Boolean(bools[name])] });
        } else {
          const uri = urls[name]?.trim();
          payload.push({
            name,
            uriValues: uri ? [{ uri }] : [],
          });
        }
      }
      if (!payload.length) return;

      const result = await saveGbpAttributesAction(clientId, payload);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setDirty(new Set());
      toast.success(
        `${payload.length} attribut${payload.length > 1 ? "s" : ""} enregistré${payload.length > 1 ? "s" : ""} sur la fiche Google.`,
      );
    });

  // Monté uniquement sur l'étape Présentation : on charge à l'ouverture
  // plutôt que d'exiger un clic pour voir ce qui est déjà posé.
  useEffect(() => {
    if (requested.current) return;
    requested.current = true;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (catalog === null) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-dashed p-3">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          {loading && <Loader2 className="size-4 animate-spin" />}
          {loading
            ? "Lecture des attributs de la fiche…"
            : "Attributs non chargés — accessibilité, identité, liens sociaux."}
        </p>
        {failed && (
          <Button variant="outline" size="sm" onClick={load}>
            <SlidersHorizontal />
            Réessayer
          </Button>
        )}
      </div>
    );
  }

  const groups = [...new Set(catalog.map(groupOf))];

  return (
    <div className="flex flex-col gap-4 rounded-md border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Attributs de la fiche</p>
        <Button
          size="sm"
          disabled={saving || dirty.size === 0}
          onClick={save}
        >
          {saving ? <Loader2 className="animate-spin" /> : <Save />}
          {dirty.size ? `Enregistrer (${dirty.size})` : "Enregistré"}
        </Button>
      </div>

      {groups.map((group) => (
        <div key={group} className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {group}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {catalog
              .filter((meta) => groupOf(meta) === group)
              .map((meta) =>
                meta.valueType === "BOOL" ? (
                  <label
                    key={meta.name}
                    className="flex items-center gap-2 text-sm"
                  >
                    <Checkbox
                      checked={Boolean(bools[meta.name])}
                      onCheckedChange={(next) => {
                        setBools((c) => ({ ...c, [meta.name]: Boolean(next) }));
                        touch(meta.name);
                      }}
                    />
                    {meta.displayName}
                  </label>
                ) : (
                  <div key={meta.name} className="flex flex-col gap-1">
                    <Label className="text-xs text-muted-foreground">
                      {meta.displayName}
                    </Label>
                    <Input
                      type="url"
                      inputMode="url"
                      placeholder="https://…"
                      value={urls[meta.name] ?? ""}
                      onChange={(event) => {
                        setUrls((c) => ({
                          ...c,
                          [meta.name]: event.target.value,
                        }));
                        touch(meta.name);
                      }}
                    />
                  </div>
                ),
              )}
          </div>
        </div>
      ))}

      <p className="text-xs text-muted-foreground">
        Écrit directement sur la fiche Google — pas de brouillon
        intermédiaire. Ne coche que ce qui est vrai : ces attributs sont
        des déclarations, pas des leviers à activer.
      </p>
    </div>
  );
}
