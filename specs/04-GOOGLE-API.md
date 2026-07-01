# 04 — Intégration Google Business Profile API

## Paysage des APIs (état 2026)

Google a éclaté l'ancienne API GMB monolithique en APIs fédérées. Celles qu'on utilise :

| Fonction | API | Base URL |
|---|---|---|
| Lister les comptes | Account Management API v1 | `mybusinessaccountmanagement.googleapis.com/v1` |
| Lister les locations | Business Information API v1 | `mybusinessbusinessinformation.googleapis.com/v1` |
| **Reviews** (list, reply, delete reply) | **GMB API v4 (legacy, toujours active)** | `mybusiness.googleapis.com/v4` |
| **Local Posts** (create, list, delete) | **GMB API v4 (legacy, toujours active)** | `mybusiness.googleapis.com/v4` |

Scope OAuth unique pour tout : `https://www.googleapis.com/auth/business.manage`. Auth par header `Authorization: Bearer {access_token}`. Les API keys ne fonctionnent PAS (401) — OAuth obligatoire.

## Endpoints utilisés

### Découverte
```
GET /v1/accounts                                  (Account Management)
GET /v1/{accounts/*}/locations?readMask=name,title,storefrontAddress,categories,phoneNumbers,websiteUri&pageSize=100
```

### Reviews
```
# Batch — jusqu'à 50 locations par appel (parfait pour ~30 clients)
POST https://mybusiness.googleapis.com/v4/accounts/{accountId}/locations:batchGetReviews
{ "locationNames": ["accounts/X/locations/Y", ...], "pageSize": 50,
  "orderBy": "updateTime desc", "ignoreRatingOnlyReviews": false }

# Répondre (crée OU met à jour la réponse — même endpoint)
PUT https://mybusiness.googleapis.com/v4/accounts/{a}/locations/{l}/reviews/{r}/reply
{ "comment": "Merci..." }

# Supprimer une réponse
DELETE .../reviews/{r}/reply
```
- `starRating` arrive comme enum (`ONE`…`FIVE`) → mapper vers int.
- `reviewer.isAnonymous` possible → afficher « Utilisateur Google ».
- Le champ `reviewReply` existant permet de détecter les reviews déjà répondues manuellement (→ status `replied` à l'import).

### Local Posts
```
POST https://mybusiness.googleapis.com/v4/accounts/{a}/locations/{l}/localPosts
{
  "languageCode": "fr-CA",
  "topicType": "STANDARD",
  "summary": "Texte du post (max 1500 chars)",
  "callToAction": { "actionType": "LEARN_MORE", "url": "https://client.com" },
  "media": [{ "mediaFormat": "PHOTO", "sourceUrl": "https://<supabase>/storage/v1/object/public/post-images/..." }]
}
```
- `sourceUrl` doit être **publiquement accessible** au moment de l'appel — Google fetch l'image. D'où le bucket public.
- Image : viser **1200×900 (4:3)**, JPEG/PNG, < 5 MB (minimum accepté ~400×300 / 10 KB — rester bien au-dessus).
- Réponse contient `name` (`accounts/.../localPosts/...`) → stocker dans `posts.gbp_post_name`, et `state` (`LIVE`, `PROCESSING`, `REJECTED`). Un post `REJECTED` (modération Google) → status `failed` + raison dans `publish_error`.

## Interface `GbpClient` (lib/gbp/client.ts)

```ts
interface GbpClient {
  listAccounts(): Promise<GbpAccount[]>
  listLocations(accountId: string): Promise<GbpLocation[]>
  batchGetReviews(accountId: string, locationNames: string[], pageToken?: string): Promise<ReviewsPage>
  putReviewReply(reviewName: string, comment: string): Promise<void>
  deleteReviewReply(reviewName: string): Promise<void>
  createLocalPost(locationName: string, post: LocalPostInput): Promise<{ name: string; state: string }>
  deleteLocalPost(postName: string): Promise<void>
}
export function getGbpClient(): GbpClient // switch sur process.env.GBP_MODE
```

### MockGbpClient
- Fixtures JSON dans `lib/gbp/fixtures/` (comptes, locations, reviews, posts).
- Stateful en DB : `putReviewReply` et `createLocalPost` écrivent réellement dans Supabase (le mock simule juste le côté Google, avec un délai artificiel 300–800 ms et ~5 % d'échecs aléatoires simulés pour tester la gestion d'erreur — désactivable via `GBP_MOCK_FAILURES=0`).
- Un script `pnpm mock:new-review` insère une nouvelle review aléatoire fake pour tester le flow en dev.

### RealGbpClient
- `fetch` natif, access token via `lib/google/token.ts`.
- **Backoff exponentiel + jitter** sur 429/5xx : 1s, 2s, 4s, 8s, max 5 essais.
- Cas spécial : 429 persistant dès le premier appel + connexion récente → probablement quota 0 (projet non approuvé) → logger `gbp_access_pending` et remonter une erreur typée `GbpAccessPendingError` que l'UI transforme en banner informatif.

## Jobs cron

### `/api/cron/sync-reviews` (aux 30 min)
1. Charger les clients `active`, groupés par `gbp_account_id`.
2. `batchGetReviews` par compte (paginer si nécessaire).
3. Upsert par `gbp_review_id` :
   - Nouvelle review sans `reviewReply` → `status='needs_reply'` → **déclencher immédiatement la génération du draft AI** (voir `05`) → `status='draft_ready'`.
   - Review modifiée (updateTime changé) → mettre à jour comment/rating; si déjà répondue et que le texte a changé, repasser en `needs_reply` avec flag `was_updated`.
   - Review avec `reviewReply` inconnu de l'app (répondu manuellement ailleurs) → `status='replied'`.
4. `clients.last_synced_at = now()`, log `sync_completed` avec compteurs.

### `/api/cron/publish-posts` (aux 15 min)
1. Sélectionner les posts `status='scheduled'` avec `scheduled_for <= now()`.
2. Pour chacun : `status='publishing'` (lock optimiste) → `createLocalPost` → `published` + `gbp_post_name` + log, ou `failed` + `publish_error`.
3. Idem pour les réponses de reviews `approved` non publiées : `putReviewReply` → review `replied`.

### `/api/cron/compute-due` (1x/jour)
Recalcule les états "dû" (la vue fait le gros du travail; ce cron sert aux notifications futures et à rafraîchir les snapshots de fiche client 1x/semaine).

## Quotas — rappel

300 QPM par API après approbation; 10 edits/min par fiche. Notre usage (~1 batch reviews/30 min + quelques publications/jour) est négligeable. Aucune demande d'augmentation nécessaire.
