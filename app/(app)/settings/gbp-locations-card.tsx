"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  importGbpLocationAction,
  listGbpLocationsAction,
} from "./actions";

interface Row {
  accountId: string;
  locationId: string;
  title: string;
  address: string | null;
  category: string | null;
  website: string | null;
  imported: boolean;
}

/**
 * Choisir quelles fiches Google deviennent des projets.
 *
 * Le compte connecté en expose beaucoup plus qu'on n'en gère (29 pour
 * 3 mandats chez Küa). Le chargement est déclenché à la main, pas au
 * rendu : chaque ouverture interroge l'API pour toutes les fiches, et
 * Réglages se visite pour bien d'autres raisons.
 */
export function GbpLocationsCard() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loading, startLoading] = useTransition();
  const [importingId, setImportingId] = useState<string | null>(null);

  const load = () =>
    startLoading(async () => {
      const result = await listGbpLocationsAction();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setRows(result.locations ?? []);
    });

  const importOne = (row: Row) => {
    setImportingId(row.locationId);
    startLoading(async () => {
      const result = await importGbpLocationAction(
        row.accountId,
        row.locationId,
      );
      setImportingId(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setRows(
        (current) =>
          current?.map((entry) =>
            entry.locationId === row.locationId
              ? { ...entry, imported: true }
              : entry,
          ) ?? null,
      );
      toast.success(`${result.name} importé — en pause.`, {
        description: "Active le projet dans Projets quand le mandat démarre.",
        action: {
          label: "Ouvrir",
          onClick: () => router.push(`/clients/${result.clientId}`),
        },
      });
    });
  };

  const pending = rows?.filter((row) => !row.imported) ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fiches Google</CardTitle>
        <CardDescription>
          Les fiches auxquelles le compte connecté a accès. Importe celles
          sous mandat — les autres restent hors de l&apos;app.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {rows === null ? (
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              La liste est chargée à la demande.
            </p>
            <Button
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={load}
            >
              <RefreshCw className={loading ? "animate-spin" : undefined} />
              Voir les fiches
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucune fiche visible. Vérifie que le compte Google connecté est
            bien gestionnaire des fiches.
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                {rows.length} fiche{rows.length > 1 ? "s" : ""} —{" "}
                {pending.length} à importer
              </p>
              <Button
                variant="ghost"
                size="sm"
                disabled={loading}
                onClick={load}
              >
                <RefreshCw className={loading ? "animate-spin" : undefined} />
                Rafraîchir
              </Button>
            </div>

            <ul className="divide-y rounded-md border">
              {rows.map((row) => (
                <li
                  key={row.locationId}
                  className="flex items-center justify-between gap-4 p-3"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {row.title}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {[row.category, row.address]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </div>
                  </div>
                  {row.imported ? (
                    <Badge variant="secondary">Importée</Badge>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={loading}
                      onClick={() => importOne(row)}
                    >
                      <Download
                        className={
                          importingId === row.locationId
                            ? "animate-pulse"
                            : undefined
                        }
                      />
                      Importer
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
