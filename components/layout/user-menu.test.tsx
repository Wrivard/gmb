import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { UserMenu } from "./user-menu";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signOut: vi.fn() } }),
}));

describe("UserMenu", () => {
  it("affiche le courriel et le rôle", () => {
    render(<UserMenu email="wrivard@kua.quebec" role="owner" />);
    expect(screen.getByText("wrivard@kua.quebec")).toBeTruthy();
    expect(screen.getByText("Admin")).toBeTruthy();
  });

  it("le déclencheur est un vrai bouton cliquable", () => {
    render(<UserMenu email="wrivard@kua.quebec" role="owner" />);
    const trigger = screen.getByRole("button");
    expect(trigger).toBeTruthy();
    expect(trigger.hasAttribute("disabled")).toBe(false);
  });

  it("ouvre le menu au clic et propose la déconnexion", async () => {
    render(<UserMenu email="wrivard@kua.quebec" role="owner" />);
    const trigger = screen.getByRole("button");

    fireEvent.pointerDown(trigger);
    fireEvent.click(trigger);

    expect(await screen.findByText("Se déconnecter")).toBeTruthy();
  });
});
