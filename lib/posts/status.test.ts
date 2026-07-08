import { describe, expect, it } from "vitest";
import type { PostStatus } from "@/lib/types/database";
import {
  isPostApprovable,
  isPostEditable,
  postGroup,
  PUBLISHABLE_FROM,
} from "./status";

const ALL: PostStatus[] = [
  "draft",
  "approved",
  "scheduled",
  "publishing",
  "published",
  "failed",
];

describe("isPostEditable", () => {
  it("interdit l'édition une fois parti chez Google", () => {
    expect(isPostEditable("published")).toBe(false);
    expect(isPostEditable("publishing")).toBe(false);
  });

  it("permet l'édition avant publication", () => {
    for (const s of ["draft", "approved", "scheduled", "failed"] as const) {
      expect(isPostEditable(s)).toBe(true);
    }
  });
});

describe("isPostApprovable", () => {
  it("draft et failed seulement (Réessayer = re-approuver)", () => {
    expect(ALL.filter(isPostApprovable)).toEqual(["draft", "failed"]);
  });
});

describe("PUBLISHABLE_FROM", () => {
  it("le membre peut court-circuiter le scheduler, pas le cron", () => {
    expect(PUBLISHABLE_FROM.member).toEqual(["draft", "scheduled", "failed"]);
    expect(PUBLISHABLE_FROM.cron).toEqual(["scheduled"]);
  });

  it("jamais de republication depuis published/publishing", () => {
    for (const from of [...PUBLISHABLE_FROM.member, ...PUBLISHABLE_FROM.cron]) {
      expect(["published", "publishing"]).not.toContain(from);
    }
  });
});

describe("postGroup", () => {
  it("partitionne comme la vue SQL posts_due", () => {
    expect(postGroup("draft")).toBe("brouillon");
    expect(postGroup("failed")).toBe("echec");
    expect(postGroup("published")).toBe("publie");
    for (const s of ["approved", "scheduled", "publishing"] as const) {
      expect(postGroup(s)).toBe("planifie");
    }
  });

  it("couvre tous les statuts (exhaustivité du switch)", () => {
    for (const s of ALL) {
      expect(postGroup(s)).toBeTruthy();
    }
  });
});
