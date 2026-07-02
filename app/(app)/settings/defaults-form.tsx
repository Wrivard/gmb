"use client";

import { useState, useTransition } from "react";
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
import { updateAgencyDefaultsAction } from "./actions";

export function DefaultsForm({
  defaultPostsPerMonth,
  defaultLanguage,
  isOwner,
}: {
  defaultPostsPerMonth: number;
  defaultLanguage: string;
  isOwner: boolean;
}) {
  const [posts, setPosts] = useState(String(defaultPostsPerMonth));
  const [language, setLanguage] = useState(defaultLanguage);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-wrap items-end gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const result = await updateAgencyDefaultsAction({
            defaultPostsPerMonth: Number(posts),
            defaultLanguage: language,
          });
          if (result.ok) toast.success("Défauts mis à jour.");
          else toast.error(result.error);
        });
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="default-posts">Posts par mois</Label>
        <Input
          id="default-posts"
          type="number"
          min={0}
          max={10}
          value={posts}
          disabled={!isOwner}
          onChange={(event) => setPosts(event.target.value)}
          className="w-24"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Langue</Label>
        <Select
          value={language}
          onValueChange={(value) => setLanguage(value as string)}
          disabled={!isOwner}
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
      {isOwner && (
        <Button type="submit" size="sm" disabled={pending}>
          Enregistrer
        </Button>
      )}
    </form>
  );
}
