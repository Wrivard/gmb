import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("fusionne les classes tailwind en gardant la dernière", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  it("ignore les valeurs falsy", () => {
    expect(cn("a", false && "b", undefined, "c")).toBe("a c");
  });
});
