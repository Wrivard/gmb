import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { deliverNotification, sendNotification } = await import("./notify");

const NOTE = { subject: "sujet", text: "corps" };

const ENV_KEYS = [
  "NOTIFY_WEBHOOK_URL",
  "RESEND_API_KEY",
  "NOTIFY_EMAIL_TO",
  "NOTIFY_EMAIL_FROM",
] as const;

let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const key of ENV_KEYS) delete process.env[key];
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  vi.restoreAllMocks();
});

function mockFetch(responses: Array<{ ok: boolean; status?: number; body?: string }>) {
  const fetchMock = vi.fn();
  for (const r of responses) {
    fetchMock.mockResolvedValueOnce({
      ok: r.ok,
      status: r.status ?? (r.ok ? 200 : 422),
      text: async () => r.body ?? "",
    });
  }
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("deliverNotification", () => {
  it("aucun canal configuré → aucun résultat (et aucun appel réseau)", async () => {
    const fetchMock = mockFetch([]);
    expect(await deliverNotification(NOTE)).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("Resend sans destinataire échoue explicitement", async () => {
    process.env.RESEND_API_KEY = "re_x";
    mockFetch([]);
    const [result] = await deliverNotification(NOTE);
    expect(result).toMatchObject({ channel: "courriel", ok: false });
    expect(result.error).toContain("NOTIFY_EMAIL_TO");
  });

  it("remonte le message du fournisseur — le cas du domaine non vérifié", async () => {
    process.env.RESEND_API_KEY = "re_x";
    process.env.NOTIFY_EMAIL_TO = "gberther@kua.quebec";
    mockFetch([
      { ok: false, status: 403, body: "You can only send testing emails to your own address" },
    ]);
    const [result] = await deliverNotification(NOTE);
    expect(result.ok).toBe(false);
    // Sans ce détail, un canal muet est indiscernable d'un canal absent.
    expect(result.error).toContain("only send testing emails");
  });

  // Le cas réel du 2026-08-13 : le domaine ÉTAIT vérifié, mais
  // NOTIFY_EMAIL_FROM manquait — l'app envoyait donc depuis le bac à
  // sable, qui bride les destinataires. Le message de Resend seul ne
  // permettait pas de trancher entre les deux causes.
  it("sans expéditeur, l'échec explique le bac à sable", async () => {
    process.env.RESEND_API_KEY = "re_x";
    process.env.NOTIFY_EMAIL_TO = "gberther@kua.quebec";
    mockFetch([{ ok: false, status: 403, body: "You can only send testing emails" }]);
    const [result] = await deliverNotification(NOTE);
    expect(result.error).toContain("NOTIFY_EMAIL_FROM");
  });

  it("avec un expéditeur de domaine, pas de conseil hors sujet", async () => {
    process.env.RESEND_API_KEY = "re_x";
    process.env.NOTIFY_EMAIL_TO = "gberther@kua.quebec";
    process.env.NOTIFY_EMAIL_FROM = "Küa Locale <bonjour@kua.quebec>";
    mockFetch([{ ok: false, status: 422, body: "autre erreur" }]);
    const [result] = await deliverNotification(NOTE);
    expect(result.error).not.toContain("NOTIFY_EMAIL_FROM");
  });

  it("l'expéditeur configuré est bien celui envoyé", async () => {
    process.env.RESEND_API_KEY = "re_x";
    process.env.NOTIFY_EMAIL_TO = "gberther@kua.quebec";
    process.env.NOTIFY_EMAIL_FROM = "Küa Locale <bonjour@kua.quebec>";
    const fetchMock = mockFetch([{ ok: true }]);
    await deliverNotification(NOTE);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.from).toBe("Küa Locale <bonjour@kua.quebec>");
  });

  it("découpe les destinataires multiples", async () => {
    process.env.RESEND_API_KEY = "re_x";
    process.env.NOTIFY_EMAIL_TO = "a@kua.quebec, b@kua.quebec";
    const fetchMock = mockFetch([{ ok: true }]);
    await deliverNotification(NOTE);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.to).toEqual(["a@kua.quebec", "b@kua.quebec"]);
  });

  it("un canal en échec n'empêche pas l'autre", async () => {
    process.env.NOTIFY_WEBHOOK_URL = "https://hooks.example/x";
    process.env.RESEND_API_KEY = "re_x";
    process.env.NOTIFY_EMAIL_TO = "gberther@kua.quebec";
    mockFetch([{ ok: false, status: 500 }, { ok: true }]);
    const results = await deliverNotification(NOTE);
    expect(results.map((r) => r.ok)).toEqual([false, true]);
  });
});

describe("sendNotification", () => {
  it("vrai dès qu'un canal accepte", async () => {
    process.env.NOTIFY_WEBHOOK_URL = "https://hooks.example/x";
    mockFetch([{ ok: true }]);
    expect(await sendNotification(NOTE)).toBe(true);
  });

  it("faux si tous les canaux échouent", async () => {
    process.env.NOTIFY_WEBHOOK_URL = "https://hooks.example/x";
    mockFetch([{ ok: false, status: 500 }]);
    expect(await sendNotification(NOTE)).toBe(false);
  });

  it("faux, sans throw, quand rien n'est configuré", async () => {
    mockFetch([]);
    await expect(sendNotification(NOTE)).resolves.toBe(false);
  });
});
