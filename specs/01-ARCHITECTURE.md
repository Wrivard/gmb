# 01 — Architecture

## Vue d'ensemble

```
┌────────────────────────── Vercel ──────────────────────────┐
│  Next.js 15 (App Router, TS)                               │
│  ├─ UI (React Server Components + client components)       │
│  ├─ Route handlers /api/*  (OAuth callback, actions)       │
│  ├─ Server Actions (approuver, publier, régénérer…)        │
│  └─ Vercel Cron                                            │
│      ├─ /api/cron/sync-reviews   (aux 30 min)              │
│      ├─ /api/cron/publish-posts  (aux 15 min)              │
│      └─ /api/cron/compute-due    (1x/jour, 6h00 ET)        │
└─────────────┬──────────────────────────┬───────────────────┘
              │                          │
     ┌────────▼─────────┐      ┌─────────▼──────────────────┐
     │ Supabase          │      │ APIs externes              │
     │ (ca-central-1)    │      │ ├─ GBP v1 (accounts, locs) │
     │ ├─ Postgres + RLS │      │ ├─ GBP v4 (reviews, posts) │
     │ ├─ Auth (équipe)  │      │ ├─ Anthropic (texte)       │
     │ └─ Storage        │      │ └─ Gemini (images)         │
     │    (images posts) │      └────────────────────────────┘
     └───────────────────┘
```

## Décisions d'architecture

1. **Monolithe Next.js.** Pas de backend séparé. Server Actions pour les mutations UI, route handlers pour OAuth/cron/webhooks.
2. **Sync par polling (cron), pas Pub/Sub au MVP.** Un cron aux 30 minutes qui fait un `batchGetReviews` (jusqu'à 50 locations par appel — ~30 clients = 1 appel) est simple, fiable, et très loin des quotas. Pub/Sub = amélioration post-MVP.
3. **Couche GBP abstraite.** `lib/gbp/client.ts` expose une interface; `mock.ts` et `real.ts` l'implémentent. `GBP_MODE` choisit. Le mock lit des fixtures JSON réalistes (voir `04-GOOGLE-API.md`).
4. **Images de posts dans Supabase Storage** (bucket public `post-images`). L'API LocalPosts exige une `sourceUrl` publique — l'URL publique Supabase fait la job.
5. **Tokens Google chiffrés** au niveau applicatif (AES-256-GCM avec `ENCRYPTION_KEY` en env) avant insertion en DB. Jamais de token en clair.
6. **Une seule agence, plusieurs utilisateurs.** Le modèle de données supporte multi-agence (table `agencies`) mais le MVP assume l'agence Küa seule. Ça garde la porte ouverte à en faire un SaaS plus tard.

## Structure du repo

```
kua-locale/
├─ app/
│  ├─ (auth)/login/page.tsx
│  ├─ (app)/
│  │  ├─ layout.tsx                 # sidebar + topbar
│  │  ├─ page.tsx                   # Dashboard Kanban
│  │  ├─ reviews/page.tsx           # Inbox reviews global
│  │  ├─ posts/page.tsx             # Calendrier/queue de posts
│  │  ├─ clients/page.tsx           # Liste clients
│  │  ├─ clients/[id]/page.tsx      # Fiche client (reviews, posts, settings)
│  │  └─ settings/page.tsx          # Connexion Google, équipe, défauts
│  └─ api/
│     ├─ google/connect/route.ts    # démarre l'OAuth
│     ├─ google/callback/route.ts   # échange le code, stocke tokens
│     └─ cron/{sync-reviews,publish-posts,compute-due}/route.ts
├─ lib/
│  ├─ gbp/{client.ts,real.ts,mock.ts,fixtures/}
│  ├─ ai/{replies.ts,posts.ts,images.ts,prompts.ts}
│  ├─ crypto.ts                     # AES-256-GCM encrypt/decrypt
│  ├─ supabase/{server.ts,client.ts,admin.ts}
│  └─ due.ts                        # logique de "dû pour un post"
├─ components/                      # shadcn/ui + composants métier
├─ supabase/migrations/*.sql
└─ ...
```

## Variables d'environnement

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=
GBP_MODE=mock                # mock | real
ANTHROPIC_API_KEY=
GEMINI_API_KEY=
ENCRYPTION_KEY=              # 32 bytes hex, openssl rand -hex 32
CRON_SECRET=                 # protège les routes /api/cron/*
NEXT_PUBLIC_APP_URL=
```

## Sécurité

- Routes cron protégées par header `Authorization: Bearer ${CRON_SECRET}` (configuré dans `vercel.json`).
- RLS activé sur toutes les tables (voir `03-DATABASE.md`); les crons utilisent le service role.
- Aucune clé AI ni token Google exposé côté client — toutes les générations passent par des Server Actions.
