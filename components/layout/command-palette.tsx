"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  MessageSquare,
  Megaphone,
  Settings,
  Users,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { confirmIfUnsaved } from "@/lib/hooks/use-unsaved-guard";

export const OPEN_PALETTE_EVENT = "kua:open-command-palette";

// Mêmes libellés que la sidebar et les onglets — les `keywords`
// gardent les anciens noms cherchables (dashboard, réglages…).
const PAGES = [
  {
    href: "/",
    label: "Aujourd'hui",
    keywords: "tableau dashboard board",
    icon: LayoutDashboard,
  },
  {
    href: "/reviews",
    label: "File reviews",
    keywords: "avis réponses",
    icon: MessageSquare,
  },
  {
    href: "/posts",
    label: "File posts",
    keywords: "publications calendrier",
    icon: Megaphone,
  },
  {
    href: "/clients",
    label: "Projets",
    keywords: "clients entreprises fiches",
    icon: Users,
  },
  {
    href: "/settings",
    label: "Agence",
    keywords: "réglages settings équipe google",
    icon: Settings,
  },
];

/** Recherche client + navigation, ouverte via ⌘K (specs/09). */
export function CommandPalette({
  clients,
}: {
  clients: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    }
    function onOpenEvent() {
      setOpen(true);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener(OPEN_PALETTE_EVENT, onOpenEvent);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpenEvent);
    };
  }, []);

  function go(href: string) {
    // router.push ne passe pas par les ancres : appliquer le garde
    // « modifications non enregistrées » ici aussi.
    if (!confirmIfUnsaved()) return;
    setOpen(false);
    router.push(href);
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Rechercher un client ou une page…" />
      <CommandList>
        <CommandEmpty>Aucun résultat.</CommandEmpty>
        {clients.length > 0 && (
          <CommandGroup heading="Projets">
            {clients.map((client) => (
              <CommandItem
                key={client.id}
                value={client.name}
                onSelect={() => go(`/clients/${client.id}`)}
              >
                <Users />
                {client.name}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        <CommandSeparator />
        <CommandGroup heading="Pages">
          {PAGES.map(({ href, label, keywords, icon: Icon }) => (
            <CommandItem
              key={href}
              value={`page ${label} ${keywords}`}
              onSelect={() => go(href)}
            >
              <Icon />
              {label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
