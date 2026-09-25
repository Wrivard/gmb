"use client";

// Responsable du projet, éditable inline depuis la liste Projets —
// même pattern que CadenceSelect. null = file commune (non assigné).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateClientAssigneeAction } from "./[id]/actions";

const UNASSIGNED = "none";

/** « prenom » à partir d'un courriel — assez pour une petite équipe. */
export function memberShortName(email: string): string {
  return email.split("@")[0];
}

export function AssigneeSelect({
  clientId,
  assigneeMemberId,
  members,
  disabled,
  quiet,
}: {
  clientId: string;
  assigneeMemberId: string | null;
  members: Array<{ id: string; email: string }>;
  disabled?: boolean;
  /** Sans bordure ni fond : dans une liste, un menu par ligne pèse trop. */
  quiet?: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(assigneeMemberId ?? UNASSIGNED);
  const [pending, startTransition] = useTransition();

  return (
    <Select
      value={value}
      disabled={disabled || pending}
      onValueChange={(next) => {
        if (typeof next !== "string" || next === value) return;
        const previous = value;
        setValue(next);
        startTransition(async () => {
          const result = await updateClientAssigneeAction(
            clientId,
            next === UNASSIGNED ? null : next,
          );
          if (result.ok) {
            router.refresh();
          } else {
            setValue(previous);
            toast.error(result.error);
          }
        });
      }}
    >
      <SelectTrigger
        size="sm"
        className={
          quiet
            ? "ml-auto w-fit min-w-0 border-transparent bg-transparent text-muted-foreground shadow-none hover:bg-muted hover:text-foreground dark:bg-transparent"
            : "w-fit min-w-24"
        }
      >
        {/* Sans fonction de rendu, Base UI affiche la VALEUR brute : la
            liste montrait « none » au lieu de « — ». */}
        <SelectValue>
          {(current: string) =>
            current === UNASSIGNED
              ? "—"
              : memberShortName(
                  members.find((m) => m.id === current)?.email ?? "",
                ) || "—"
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={UNASSIGNED}>—</SelectItem>
        {members.map((m) => (
          <SelectItem key={m.id} value={m.id}>
            {memberShortName(m.email)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
