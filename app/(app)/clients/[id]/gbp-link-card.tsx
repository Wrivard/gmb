"use client";

// Liaison manuelle à la fiche Google.
//
// Pont tant que le quota d'Account Management est à zéro : la découverte
// automatique ne tourne pas, mais l'API v4 (avis, publications) a du
// quota. Saisir les deux identifiants suffit à débloquer l'essentiel.

import { useState, useTransition } from "react";
import { Link2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { updateGbpLinkAction } from "./actions";

export function GbpLinkCard({
  clientId,
  accountId,
  locationId,
  readOnly = false,
}: {
  clientId: string;
  accountId: string | null;
  locationId: string | null;
  readOnly?: boolean;
}) {
  const [account, setAccount] = useState(accountId ?? "");
  const [location, setLocation] = useState(locationId ?? "");
  const [pending, startTransition] = useTransition();

  const linked = Boolean(accountId && locationId);
  const dirty = account !== (accountId ?? "") || location !== (locationId ?? "");

  function save() {
    startTransition(async () => {
      const result = await updateGbpLinkAction(clientId, {
        accountId: account,
        locationId: location,
      });
      if (result.ok) {
        toast.success(
          account.trim() || location.trim()
            ? "Fiche Google liée — avis et publications peuvent partir."
            : "Fiche déliée.",
        );
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>Fiche Google liée</CardTitle>
          <Badge variant={linked ? "default" : "secondary"}>
            {linked ? "Liée" : "Non liée"}
          </Badge>
        </div>
        <CardDescription>
          À saisir à la main tant que la découverte automatique est bloquée
          (quota Google). Les identifiants se trouvent dans l&apos;URL de la
          fiche depuis ton tableau de bord Google Business — tu peux coller
          l&apos;URL entière, le nom complet, ou juste les numéros.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="gbp-account">Compte</Label>
            <Input
              id="gbp-account"
              value={account}
              onChange={(event) => setAccount(event.target.value)}
              placeholder="accounts/108231694201573849275"
              disabled={readOnly || pending}
              spellCheck={false}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="gbp-location">Fiche</Label>
            <Input
              id="gbp-location"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="locations/7261849305718293645"
              disabled={readOnly || pending}
              spellCheck={false}
            />
          </div>
        </div>

        {!readOnly && (
          <div className="flex items-center gap-3">
            <Button size="sm" onClick={save} disabled={!dirty || pending}>
              {pending ? <Loader2 className="animate-spin" /> : <Link2 />}
              Enregistrer la liaison
            </Button>
            {!linked && (
              <p className="text-xs text-muted-foreground">
                Sans liaison, rien ne part vers Google pour ce projet.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
