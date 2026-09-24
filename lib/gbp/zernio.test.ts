import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ZernioGbpClient,
  clearZernioCache,
  listZernioConnections,
} from "./zernio";
import type { GbpClient } from "./client";

// Les formes testées ici viennent d'appels RÉELS à l'API Zernio le
// 2026-09-23 (compte de Küa, 29 fiches clientes), pas de la doc — deux
// erreurs de ce chantier venaient justement d'avoir cru la doc.

const ACCOUNT = "accounts/105632708962948265692";
const GESTION = "163042809143219755";
const BOBOIS = "7279736039135886148";

interface Call {
  url: string;
  method: string;
  body: unknown;
}

let calls: Call[] = [];

/** Router minimal : chaque endpoint rend la forme observée en vrai. */
function stubFetch(overrides: Record<string, unknown> = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      calls.push({
        url,
        method: init.method ?? "GET",
        body: init.body ? JSON.parse(String(init.body)) : undefined,
      });

      const respond = (payload: unknown) =>
        new Response(JSON.stringify(payload), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });

      for (const [fragment, payload] of Object.entries(overrides)) {
        if (url.includes(fragment)) return respond(payload);
      }

      if (url.endsWith("/accounts")) {
        return respond({
          accounts: [{ _id: "zern1", platform: "googlebusiness" }],
        });
      }
      if (url.includes("/gmb-locations")) {
        return respond({
          locations: [
            {
              id: GESTION,
              name: "Gestion concept sur mesure",
              accountId: ACCOUNT,
              accountName: "Guillaume Berther",
              category: "General contractor",
            },
            {
              id: BOBOIS,
              name: "Bobois Design",
              accountId: ACCOUNT,
              accountName: "Guillaume Berther",
              address: "1383 rue main, Ayer's Cliff, QC",
              category: "Ébéniste",
            },
          ],
        });
      }
      if (url.includes("/gmb-location-details")) {
        return respond({
          title: "Bobois Design",
          phoneNumbers: { primaryPhone: "(819) 555-0100" },
          categories: { primaryCategory: { displayName: "Ébéniste" } },
        });
      }
      if (url.includes("/gmb-reviews/batch")) {
        return respond({
          locationReviews: [
            {
              name: `${ACCOUNT}/locations/${GESTION}`,
              review: {
                reviewId: "r1",
                reviewer: { displayName: "Ylan" },
                starRating: "FIVE",
                comment: "Très satisfait.",
                createTime: "2026-09-23T15:06:26Z",
                updateTime: "2026-09-23T16:14:25Z",
                name: `${ACCOUNT}/locations/${GESTION}/reviews/r1`,
              },
            },
            {
              name: `${ACCOUNT}/locations/${GESTION}`,
              // Avis note seule : vérifié en production, Zernio les rend.
              review: {
                reviewId: "r2",
                reviewer: { displayName: "Anon" },
                starRating: "FOUR",
                createTime: "2026-09-20T10:00:00Z",
                updateTime: "2026-09-20T10:00:00Z",
                name: `${ACCOUNT}/locations/${GESTION}/reviews/r2`,
              },
            },
          ],
          nextPageToken: "page2",
        });
      }
      return respond({ ok: true });
    }),
  );
}

beforeEach(() => {
  calls = [];
  clearZernioCache();
  vi.stubEnv("ZERNIO_API_KEY", "sk_test");
  stubFetch();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("authentification", () => {
  it("échoue clairement sans clé", async () => {
    vi.stubEnv("ZERNIO_API_KEY", "");
    await expect(new ZernioGbpClient().listAccounts()).rejects.toThrow(
      /ZERNIO_API_KEY manquante/,
    );
  });
});

describe("listAccounts", () => {
  it("rend le compte Google, pas l'id interne Zernio", async () => {
    const accounts = await new ZernioGbpClient().listAccounts();
    expect(accounts).toHaveLength(1);
    expect(accounts[0].name).toBe(ACCOUNT);
    expect(accounts[0].accountName).toBe("Guillaume Berther");
  });

  it("explique quoi faire si rien n'est connecté", async () => {
    stubFetch({ "/accounts": { accounts: [] } });
    await expect(new ZernioGbpClient().listAccounts()).rejects.toThrow(
      /choisir une fiche/,
    );
  });
});

// Réglages lisait `google_connections` — la connexion Google DIRECTE,
// inutilisée en mode zernio — et affichait « Connectée » alors que rien
// ne passait par là.
describe("listZernioConnections", () => {
  it("rend le compte Google et le nombre de fiches qu'il expose", async () => {
    const connections = await listZernioConnections();
    expect(connections).toEqual([
      {
        googleAccount: ACCOUNT,
        accountName: "Guillaume Berther",
        locationCount: 2,
      },
    ]);
  });

  it("propage l'absence de connexion au lieu de rendre une liste vide", async () => {
    stubFetch({ "/accounts": { accounts: [] } });
    await expect(listZernioConnections()).rejects.toThrow(/choisir une fiche/);
  });
});

describe("listLocations", () => {
  // Mesuré le 2026-09-23 : détailler les 29 fiches coûtait 30 appels et
  // 2,6 s, soit la moitié du budget d'une minute, pour 3 mandats suivis.
  it("énumère sans payer un appel de détail par fiche", async () => {
    const locations = await new ZernioGbpClient().listLocations(ACCOUNT);
    expect(locations).toHaveLength(2);
    expect(locations[0].name).toBe(`locations/${GESTION}`);
    expect(
      calls.filter((call) => call.url.includes("gmb-location-details")),
    ).toHaveLength(0);
  });

  it("rend ce que la liste plate donne gratuitement", async () => {
    const locations = await new ZernioGbpClient().listLocations(ACCOUNT);
    const bobois = locations[1];
    expect(bobois.title).toBe("Bobois Design");
    expect(bobois.storefrontAddress?.addressLines).toEqual([
      "1383 rue main, Ayer's Cliff, QC",
    ]);
    expect(bobois.categories?.primaryCategory?.displayName).toBe("Ébéniste");
  });

  // Le tri « sous mandat » vs le reste appartient à l'app (Réglages →
  // Fiches Google) : le client rend tout ce que le compte voit.
  it("rend toutes les fiches du compte, sans filtrer", async () => {
    const locations = await new ZernioGbpClient().listLocations(ACCOUNT);
    expect(locations.map((l) => l.name)).toEqual([
      `locations/${GESTION}`,
      `locations/${BOBOIS}`,
    ]);
  });
});

describe("getLocation", () => {
  it("ne détaille QUE la fiche demandée", async () => {
    const location = await new ZernioGbpClient().getLocation(
      ACCOUNT,
      `locations/${BOBOIS}`,
    );
    expect(location.phoneNumbers?.primaryPhone).toBe("(819) 555-0100");
    const details = calls.filter((call) =>
      call.url.includes("gmb-location-details"),
    );
    expect(details).toHaveLength(1);
    expect(details[0].url).toContain(`locationId=${BOBOIS}`);
  });

  it("accepte un nom complet comme un id nu", async () => {
    await new ZernioGbpClient().getLocation(
      ACCOUNT,
      `${ACCOUNT}/locations/${BOBOIS}`,
    );
    const details = calls.filter((call) =>
      call.url.includes("gmb-location-details"),
    );
    expect(details[0].url).toContain(`locationId=${BOBOIS}`);
  });

  // Le détail peut taire un champ que la liste plate porte : ne pas
  // écraser une adresse connue par `undefined`.
  it("retombe sur la liste plate quand le détail est muet", async () => {
    stubFetch({
      "gmb-location-details": { title: "Bobois Design" },
    });
    const location = await new ZernioGbpClient().getLocation(
      ACCOUNT,
      `locations/${BOBOIS}`,
    );
    expect(location.storefrontAddress?.addressLines).toEqual([
      "1383 rue main, Ayer's Cliff, QC",
    ]);
    expect(location.categories?.primaryCategory?.displayName).toBe("Ébéniste");
  });
});

describe("batchGetReviews", () => {
  it("complète les noms de fiche — Zernio rejette les noms courts (400)", async () => {
    await new ZernioGbpClient().batchGetReviews(ACCOUNT, [
      `locations/${GESTION}`,
      BOBOIS,
    ]);
    const batch = calls.find((c) => c.url.includes("/gmb-reviews/batch"));
    expect(batch?.body).toMatchObject({
      locationNames: [
        `${ACCOUNT}/locations/${GESTION}`,
        `${ACCOUNT}/locations/${BOBOIS}`,
      ],
    });
  });

  it("regroupe la réponse aplatie par fiche et garde les avis sans texte", async () => {
    const page = await new ZernioGbpClient().batchGetReviews(ACCOUNT, [
      `locations/${GESTION}`,
    ]);
    expect(page.locationReviews).toHaveLength(1);
    expect(page.locationReviews[0].reviews).toHaveLength(2);
    expect(page.locationReviews[0].reviews[1].comment).toBeUndefined();
    expect(page.nextPageToken).toBe("page2");
  });
});

describe("écritures", () => {
  it("putReviewReply encode le nom de review (il contient des /)", async () => {
    const reviewName = `${ACCOUNT}/locations/${GESTION}/reviews/r1`;
    await new ZernioGbpClient().putReviewReply(reviewName, "Merci !");
    const reply = calls.find((c) => c.url.includes("/inbox/reviews/"));
    expect(reply?.url).toContain(encodeURIComponent(reviewName));
    expect(reply?.method).toBe("POST");
    expect(reply?.body).toEqual({ accountId: "zern1", message: "Merci !" });
  });

  it("updateLocation met updateMask dans le CORPS, pas en query", async () => {
    await new ZernioGbpClient().updateLocation(
      `locations/${GESTION}`,
      { profile: { description: "Nouvelle description" } },
      "profile.description",
    );
    const put = calls.find((c) => c.method === "PUT");
    expect(put?.url).toContain(`locationId=${GESTION}`);
    expect(put?.url).not.toContain("updateMask=");
    expect(put?.body).toEqual({
      updateMask: "profile.description",
      profile: { description: "Nouvelle description" },
    });
  });

  it("createLocalPost cible la bonne fiche et porte le bouton d'action", async () => {
    stubFetch({ "/posts": { _id: "post123", platforms: [] } });
    const result = await new ZernioGbpClient().createLocalPost(
      `locations/${GESTION}`,
      {
        languageCode: "fr-CA",
        topicType: "STANDARD",
        summary: "Nouvelle réalisation",
        callToAction: { actionType: "LEARN_MORE", url: "https://kua.quebec" },
      },
    );
    const post = calls.find((c) => c.url.endsWith("/posts"));
    expect(post?.body).toMatchObject({
      content: "Nouvelle réalisation",
      platforms: [
        {
          platform: "googlebusiness",
          accountId: "zern1",
          platformSpecificData: {
            locationId: `locations/${GESTION}`,
            callToAction: { type: "LEARN_MORE", url: "https://kua.quebec" },
          },
        },
      ],
      publishNow: true,
    });
    expect(result.state).toBe("LIVE");
    expect(result.name).toContain("post123");
  });

  it("remonte un refus de publication", async () => {
    stubFetch({
      "/posts": {
        _id: "p1",
        platforms: [
          { platform: "googlebusiness", status: "failed", error: "quota" },
        ],
      },
    });
    await expect(
      new ZernioGbpClient().createLocalPost(`locations/${GESTION}`, {
        languageCode: "fr-CA",
        topicType: "STANDARD",
        summary: "Test",
      }),
    ).rejects.toThrow(/refusée/);
  });

  // Zernio ne documente pas la suppression ; échouer bruyamment vaut
  // mieux que faire croire que c'est parti.
  it("deleteLocalPost refuse au lieu de mentir", async () => {
    // Via l'interface : c'est par là que l'app l'appellerait.
    const client: GbpClient = new ZernioGbpClient();
    await expect(client.deleteLocalPost("x")).rejects.toThrow(/suppression/);
  });
});

describe("fiche inconnue", () => {
  it("nomme la fiche qui n'est pas servie par la connexion", async () => {
    await expect(
      new ZernioGbpClient().listLocations("accounts/999"),
    ).rejects.toThrow(/accounts\/999/);
  });
});
