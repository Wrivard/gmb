import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "./command";

// Régression Sentry dfeee89c (production, 2026-08-11) :
// « can't access property "subscribe", t is undefined ».
// CommandDialog rendait ses enfants sans le conteneur <Command>, qui
// crée le store cmdk — chaque sous-composant plantait à l'ouverture.
// Ce test échoue si le conteneur disparaît à nouveau.

function renderPalette() {
  return render(
    <CommandDialog open onOpenChange={() => {}}>
      <CommandInput placeholder="Rechercher un client ou une page…" />
      <CommandList>
        <CommandEmpty>Aucun résultat.</CommandEmpty>
        <CommandGroup heading="Projets">
          <CommandItem value="Toitures Bergeron">Toitures Bergeron</CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Pages">
          <CommandItem value="page Agence réglages">Agence</CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>,
  );
}

describe("CommandDialog", () => {
  it("s'ouvre sans planter — le store cmdk est fourni aux enfants", () => {
    expect(() => renderPalette()).not.toThrow();
  });

  it("affiche le champ de recherche et les entrées des deux groupes", () => {
    renderPalette();
    expect(
      screen.getByPlaceholderText("Rechercher un client ou une page…"),
    ).toBeTruthy();
    expect(screen.getByText("Toitures Bergeron")).toBeTruthy();
    expect(screen.getByText("Agence")).toBeTruthy();
  });
});
