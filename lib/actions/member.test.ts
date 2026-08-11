import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgencyMember } from "@/lib/types/database";

// Le rituel d'autorisation des server actions n'avait aucune couverture :
// c'est pourtant lui qui décide seul qui peut écrire (la RLS le double
// depuis 20260811000017, mais le service-role la contourne en prod).

vi.mock("server-only", () => ({}));

const { sessionMock, dbMock } = vi.hoisted(() => ({
  sessionMock: vi.fn(),
  dbMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getSessionContext: sessionMock }));
vi.mock("@/lib/supabase/db", () => ({ getDb: dbMock }));

const {
  assertOwner,
  getOwnerDb,
  requireMember,
  requireOwner,
  runAction,
} = await import("./member");

function member(role: "owner" | "member"): AgencyMember {
  return {
    id: "b0000000-0000-4000-8000-000000000001",
    agency_id: "a0000000-0000-4000-8000-000000000001",
    user_id: "60843a4b-cc91-4151-9202-b71e320c88c8",
    email: "membre@kua.quebec",
    role,
  } as unknown as AgencyMember;
}

beforeEach(() => {
  sessionMock.mockReset();
  dbMock.mockReset();
  dbMock.mockResolvedValue({ from: vi.fn() });
});

describe("requireMember", () => {
  it("rejette une session sans ligne whitelist", async () => {
    sessionMock.mockResolvedValue({ user: { id: "u1" }, member: null });
    await expect(requireMember()).rejects.toThrow("Non autorisé.");
  });

  it("rend le membre quand il est whitelisté", async () => {
    sessionMock.mockResolvedValue({ user: { id: "u1" }, member: member("member") });
    await expect(requireMember()).resolves.toMatchObject({ role: "member" });
  });
});

describe("assertOwner", () => {
  it("laisse passer un admin", () => {
    expect(() => assertOwner(member("owner"))).not.toThrow();
  });

  it("bloque un membre simple", () => {
    expect(() => assertOwner(member("member"))).toThrow(
      "Action réservée aux admins.",
    );
  });

  it("porte le message du site d'appel", () => {
    expect(() => assertOwner(member("member"), "Seul un admin peut archiver.")).toThrow(
      "Seul un admin peut archiver.",
    );
  });
});

describe("requireOwner", () => {
  it("bloque un membre simple avant toute écriture", async () => {
    sessionMock.mockResolvedValue({ user: { id: "u1" }, member: member("member") });
    await expect(requireOwner("Seul un admin peut gérer l'équipe.")).rejects.toThrow(
      "Seul un admin peut gérer l'équipe.",
    );
  });

  it("laisse passer un admin", async () => {
    sessionMock.mockResolvedValue({ user: { id: "u1" }, member: member("owner") });
    await expect(requireOwner()).resolves.toMatchObject({ role: "owner" });
  });

  it("getOwnerDb n'ouvre pas de client pour un non-admin", async () => {
    sessionMock.mockResolvedValue({ user: { id: "u1" }, member: member("member") });
    await expect(getOwnerDb()).rejects.toThrow();
    expect(dbMock).not.toHaveBeenCalled();
  });
});

describe("runAction", () => {
  it("convertit une exception en {ok:false} avec son message", async () => {
    const result = await runAction("secours", async () => {
      throw new Error("Seul un admin peut gérer l'équipe.");
    });
    expect(result).toEqual({
      ok: false,
      error: "Seul un admin peut gérer l'équipe.",
    });
  });

  it("retombe sur le message de secours si ce n'est pas une Error", async () => {
    const result = await runAction("secours", async () => {
      throw "boom";
    });
    expect(result).toEqual({ ok: false, error: "secours" });
  });

  it("laisse passer un succès", async () => {
    await expect(runAction("secours", async () => ({ ok: true }) as const)).resolves.toEqual(
      { ok: true },
    );
  });

  // Le contrat que les server actions exposent réellement à l'UI :
  // requireOwner jette, runAction traduit — le refus reste {ok,error}.
  it("un refus d'admin ressort en {ok:false} pour l'UI", async () => {
    sessionMock.mockResolvedValue({ user: { id: "u1" }, member: member("member") });
    const result = await runAction("Échec de l'ajout.", async () => {
      await requireOwner("Seul un admin peut gérer l'équipe.");
      return { ok: true } as const;
    });
    expect(result).toEqual({
      ok: false,
      error: "Seul un admin peut gérer l'équipe.",
    });
  });
});
