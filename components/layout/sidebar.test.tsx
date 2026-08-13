import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Sidebar } from "./sidebar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signOut: vi.fn() } }),
}));

const DEMO = /données de démonstration/i;
const SIMULE = /Google simulé/i;

afterEach(() => {
  vi.unstubAllEnvs();
});

function renderSidebar(demoDataMode: boolean) {
  return render(
    <Sidebar
      userEmail="wrivard@kua.quebec"
      userRole="owner"
      demoDataMode={demoDataMode}
    />,
  );
}

describe("Sidebar — indicateurs de mode", () => {
  // Régression : le badge lisait NEXT_PUBLIC_GBP_MODE (l'API Google)
  // tout en annonçant « données simulées ». Il restait donc « démo »
  // même après la bascule réel/démo de Réglages.
  it("le badge de données suit la bascule, pas le mode Google", () => {
    vi.stubEnv("NEXT_PUBLIC_GBP_MODE", "mock");
    const { unmount } = renderSidebar(true);
    expect(screen.queryByText(DEMO)).not.toBeNull();
    unmount();

    renderSidebar(false);
    expect(screen.queryByText(DEMO)).toBeNull();
  });

  it("le mode Google simulé s'affiche séparément", () => {
    vi.stubEnv("NEXT_PUBLIC_GBP_MODE", "mock");
    renderSidebar(false);
    expect(screen.queryByText(SIMULE)).not.toBeNull();
  });

  it("en réel des deux côtés, aucun bandeau de mode", () => {
    vi.stubEnv("NEXT_PUBLIC_GBP_MODE", "real");
    renderSidebar(false);
    expect(screen.queryByText(DEMO)).toBeNull();
    expect(screen.queryByText(SIMULE)).toBeNull();
  });
});
