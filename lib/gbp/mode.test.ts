import { describe, expect, it } from "vitest";
import { gbpMode, isLiveGbp, isSimulatedGbp } from "./mode";

// Régression de conception : six endroits testaient `GBP_MODE === "real"`.
// En ajoutant `zernio`, chacun aurait rangé un vrai commerce du côté
// simulé — la découverte aurait marqué les 29 fiches clientes `is_demo`,
// et le cron les aurait ignorées. D'où le helper, et ce test.

describe("gbpMode", () => {
  it("reconnaît les trois modes", () => {
    expect(gbpMode("mock")).toBe("mock");
    expect(gbpMode("real")).toBe("real");
    expect(gbpMode("zernio")).toBe("zernio");
  });

  it("retombe sur mock quand la variable est absente ou inconnue", () => {
    expect(gbpMode(undefined)).toBe("mock");
    expect(gbpMode("")).toBe("mock");
    expect(gbpMode("REAL")).toBe("mock");
  });
});

describe("isSimulatedGbp / isLiveGbp", () => {
  it("zernio est un mode RÉEL, pas une simulation", () => {
    expect(isSimulatedGbp("zernio")).toBe(false);
    expect(isLiveGbp("zernio")).toBe(true);
  });

  it("real aussi", () => {
    expect(isSimulatedGbp("real")).toBe(false);
    expect(isLiveGbp("real")).toBe(true);
  });

  it("mock est la seule simulation", () => {
    expect(isSimulatedGbp("mock")).toBe(true);
    expect(isLiveGbp("mock")).toBe(false);
    expect(isSimulatedGbp(undefined)).toBe(true);
  });
});
