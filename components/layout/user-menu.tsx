"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserMenu({
  email,
  role,
}: {
  email: string | null;
  role: string | null;
}) {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (!email) {
    return (
      <div className="flex items-center gap-3 rounded-md px-3 py-2">
        <span className="flex size-7 items-center justify-center rounded-full bg-hover text-xs text-muted-foreground">
          ?
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm">Non connecté</p>
          <p className="truncate text-xs text-muted-foreground">
            Supabase non configuré
          </p>
        </div>
      </div>
    );
  }

  const initial = email.charAt(0).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-hover">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-medium text-primary">
          {initial}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm">{email}</p>
          <p className="truncate text-xs text-muted-foreground">
            {role === "owner" ? "Admin" : "Membre"}
          </p>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-56">
        <DropdownMenuLabel className="truncate">{email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={signOut}>
          <LogOut className="size-4" />
          Se déconnecter
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
