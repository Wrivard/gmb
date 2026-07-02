"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AgencyMember, MemberRole } from "@/lib/types/database";
import { addMemberAction, removeMemberAction } from "./actions";

export function TeamSection({
  members,
  currentMemberId,
  isOwner,
}: {
  members: AgencyMember[];
  currentMemberId: string;
  isOwner: boolean;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("member");
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col divide-y divide-border">
        {members.map((m) => (
          <li key={m.id} className="flex items-center gap-3 py-2.5">
            <div className="flex-1 text-sm">
              <span className="font-medium">{m.email}</span>
              {m.id === currentMemberId && (
                <span className="ml-2 text-xs text-muted-foreground">
                  (toi)
                </span>
              )}
            </div>
            <Badge variant={m.role === "owner" ? "default" : "secondary"}>
              {m.role === "owner" ? "Admin" : "Membre"}
            </Badge>
            {isOwner && m.id !== currentMemberId && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Retirer ${m.email}`}
                onClick={() =>
                  startTransition(async () => {
                    const result = await removeMemberAction(m.id);
                    if (result.ok) toast.success(`${m.email} retiré.`);
                    else toast.error(result.error);
                  })
                }
              >
                <Trash2 />
              </Button>
            )}
          </li>
        ))}
      </ul>

      {isOwner && (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            startTransition(async () => {
              const result = await addMemberAction(email, role);
              if (result.ok) {
                toast.success(`${email.trim().toLowerCase()} ajouté.`);
                setEmail("");
              } else {
                toast.error(result.error);
              }
            });
          }}
        >
          <Input
            type="email"
            required
            placeholder="courriel@kua.quebec"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-64"
          />
          <Select
            value={role}
            onValueChange={(value) => setRole(value as MemberRole)}
          >
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="member">Membre</SelectItem>
              <SelectItem value="owner">Admin</SelectItem>
            </SelectContent>
          </Select>
          <Button type="submit" size="sm" disabled={pending || !email.trim()}>
            Ajouter
          </Button>
        </form>
      )}
    </div>
  );
}
