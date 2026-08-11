import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { HealthCard } from "./health-card";
import type { HealthCheck } from "@/lib/health/checks";

// La logique du diagnostic est testée dans lib/health/checks.test.ts.
// Ici : le rendu — le composant avait été livré sans jamais être affiché.

const check = (status: HealthCheck["status"], label: string): HealthCheck => ({
  key: label,
  label,
  status,
  detail: `détail ${label}`,
});

describe("HealthCard", () => {
  it("liste chaque vérification avec son détail", () => {
    render(
      <HealthCard
        checks={[check("ok", "Clé de chiffrement"), check("warn", "Alertes")]}
      />,
    );
    expect(screen.getByText("Clé de chiffrement")).toBeTruthy();
    expect(screen.getByText("détail Alertes")).toBeTruthy();
  });

  it("résume par le pire statut — un bloquant l'emporte sur un avertissement", () => {
    render(
      <HealthCard
        checks={[
          check("ok", "URL"),
          check("warn", "Alertes"),
          check("critical", "Secret des tâches planifiées"),
        ]}
      />,
    );
    expect(screen.getByText("Bloquant")).toBeTruthy();
  });

  it("tout au vert donne « Prêt »", () => {
    render(<HealthCard checks={[check("ok", "URL"), check("ok", "Alertes")]} />);
    expect(screen.getByText("Prêt")).toBeTruthy();
  });
});
