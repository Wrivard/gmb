# PROGRESS — Küa Locale

> Journal de bord du build autonome. **À relire en premier à chaque reprise de session.**
> Protocole : specs/10-PLAN-DE-BUILD.md. Source de vérité : specs/.

## État courant

- **Déployé en production** : https://kua-locale.vercel.app (projet Vercel `kua-locale`, repo GitHub connecté — push sur `main` = déploiement auto).
- **Smoke test §4 passé** (2026-07-04, local + prod, mode mock) : auth/whitelist, 5 pages branchées Supabase (données réelles, pas de fallback démo), connexion Google mock (`connected=1`), crons protégés (401 sans bearer).
- Les crons ne s'exécutent pas encore : `SUPABASE_SERVICE_ROLE_KEY` manquante sur Vercel (dashboard seulement) → voir « Requis de William ».
- Remote GitHub : `Wrivard/gmb` (push autonome autorisé).

## Phases

- [x] Phase 0 — Fondations ✅ (commit `feat: fondations`)
- [x] Phase 1 — Auth app + données ✅ (commit `feat: auth Supabase`)
- [x] Phase 2 — Couche GBP (mock + real) ✅ (commit `feat: couche GBP`)
- [x] Phase 3 — Sync reviews + engine AI ✅ (commit `feat: cron sync-reviews`)
- [x] Phase 4 — Inbox Reviews (UI) ✅ (commit `feat: inbox reviews`)
- [x] Phase 5 — Module Posts ✅ (commit `feat: module posts`)
- [x] Phase 6 — Dashboard Kanban ✅ (commit `feat: dashboard kanban`)
- [x] Phase 7 — Polish & robustesse ✅ (commit `polish: ...`)
- [x] Phase 8 — Prod readiness ✅ (commit `feat: prod readiness`) — smoke test en attente d'un env 🧍
- [ ] Phase 4 — Inbox Reviews (UI)
- [ ] Phase 5 — Module Posts
- [ ] Phase 6 — Dashboard Kanban
- [ ] Phase 7 — Polish & robustesse
- [ ] Phase 8 — Prod readiness 🧍

## Décisions

| # | Décision | Justification |
|---|---|---|
| 1 | Specs déplacées de la racine vers `specs/` | PROMPT-INITIAL les attend dans `./specs/`; libère la racine pour l'app. |
| 2 | Next.js 15.5.19 (create-next-app@15), React 19, Tailwind 4.3 | Dernière 15.x stable — la spec impose Next 15, pas 16. |
| 3 | `NEXT_PUBLIC_GBP_MODE` ajouté en plus de `GBP_MODE` | Le badge « MODE DÉMO » (specs/08) doit être lisible côté client; `GBP_MODE` reste la source serveur. |
| 4 | `agency_members.user_id` nullable + trigger `on_auth_user_created` | La whitelist doit exister avant le premier login; le trigger lie le compte auth à l'email au signup. |
| 5 | Vue `client_board_state` = vue simple `security_invoker` | 30 clients — pas besoin de matérialisation (specs/03); invoker pour respecter RLS. |
| 6 | Colonne `posts.angle` ajoutée au schéma | specs/07 exige de stocker l'angle et de le réinjecter pour la rotation des posts. |
| 7 | Colonne `reviews.was_updated` ajoutée | specs/04 demande un flag quand une review répondue est modifiée. |
| 8 | Supabase CLI via devDependency `supabase` (npm) | CLI non installé globalement sur la machine; `pnpm exec supabase` suffit. |
| 9 | Engine AI = **OpenAI** (`OPENAI_API_KEY`), pas Anthropic | Décision de William (2026-07-02) — remplace le choix Anthropic de la spec pour éviter tout coût API Claude en double de son abonnement. Fallback stub tant que la clé manque. |
| 10 | `mock:new-review` = script Node pur (`.mjs`) via `node --env-file-if-exists` | Zéro dépendance ajoutée (pas de tsx/ts-node); Node 24 lit `.env.local` nativement. |
| 11 | `Relationships: []` ajouté à la vue dans `lib/types/database.ts` | Sans lui, le type `Database` échoue la contrainte `GenericSchema` de supabase-js → toutes les requêtes typées `never`. |
| 12 | Modèle OpenAI par défaut : `gpt-4.1-mini` (surchargeable via `OPENAI_MODEL`) | Supporte `temperature` (specs/07 exige 0.5/0.7) et `response_format: json_object`, contrairement à la famille gpt-5 (reasoning) qui verrouille la température. Bon ratio qualité/coût pour du texte court. |
| 13 | Auto-publish des réponses ≥ 4★ fait dans le cron sync (pas un cron séparé) | Le draft vient d'être généré, le client est en main; en cas d'échec → `approved` + `publish_error`, le cron publish (phase 5) sert de filet de retry. |
| 14 | Crons fréquents via GitHub Actions, `vercel.json` ne garde que compute-due | Le plan Vercel Hobby limite ses crons à 1x/jour (erreur au déploiement sinon). GH Actions est gratuit : workflow aux 15 min (publish-posts), sync-reviews aux 30 min via garde sur la minute. Secrets GitHub requis : `CRON_SECRET` + var `APP_URL`. |
| 15 | `getDb()` : service role si dispo, sinon client de session (RLS) | La clé service_role n'est pas récupérable via le MCP Supabase. Les pages/actions passent par `lib/supabase/db.ts` — RLS membre couvre tout (migration 003 ajoute les policies insert manquantes : activity_log + storage). Les crons gardent `createAdminClient` (pas de session) et exigeront la clé au déploiement. Défense en profondeur en bonus. |

## 🧍 Requis de William

Tout est encodé dans **DEPLOY.md** (checklist ordonnée). En résumé :

- [x] **Projet Supabase** : `kua-locale` (`czugrjtabomdngbxzhhr`, ca-central-1, free tier) créé le 2026-07-02 via MCP — migrations + seed appliqués, `.env.local` écrit. Compte de William créé (`wrivard@kua.quebec`, mdp temporaire connu de lui). ⚠️ Kua-coif et kua-loop-engine ont été **pausés** pour libérer les slots free (réactivables depuis le dashboard).
- [ ] Clé `SUPABASE_SERVICE_ROLE_KEY` (dashboard → Settings → API keys) — requise seulement pour les **crons**; à ajouter via `vercel env add SUPABASE_SERVICE_ROLE_KEY production` puis redéployer. Ensuite réactiver les crons GitHub Actions : `gh variable set APP_URL --repo Wrivard/gmb --body "https://kua-locale.vercel.app"` (retirée volontairement pour éviter des runs rouges aux 15 min en attendant la clé).
- [ ] Supabase Auth (dashboard → Authentication) : `Site URL` = `https://kua-locale.vercel.app`, ajouter `https://kua-locale.vercel.app/auth/callback` aux Redirect URLs, activer le provider **Google** (client ID/secret GCP) — le login email/mdp fonctionne déjà sans ça.
- [ ] Checklist Google complète de `specs/00-PREREQUIS-GOOGLE.md` (projet GCP, APIs, OAuth consent, client ID, demande Basic API Access).
- [ ] Clé `OPENAI_API_KEY` (engine réponses/posts — stub déterministe en attendant).
- [ ] Clé `GEMINI_API_KEY` (images de posts — placeholder « image à ajouter » en attendant).

## Journal

### Déploiement Vercel + smoke test (2026-07-04)
- Décision (William) : **rester sur Supabase free tier** après deep dive des alternatives (Neon/Better Auth/Convex/etc.) — les crons GH Actions gardent le projet actif, migration non justifiée.
- Vérifs : `tsc` vert, 36 tests verts, `next build` vert. DB déjà provisionnée (3 migrations, seed complet, bucket, compte William).
- Compte `equipe@kua.quebec` activé (signup API + confirmation SQL; le trigger de whitelist a lié le compte). Mdp temporaire hors repo (scratchpad session) — **à changer** au premier login.
- Smoke test HTTP (local puis prod, session cookie `@supabase/ssr` reconstruite) : redirection login, 5 pages avec données réelles (UUIDs, zéro id `demo-`), connexion Google mock OK (promotion owner temporaire), `google_connections` active, crons 401/500 (500 = service role absente, attendu).
- Vercel : projet `kua-locale` créé + lié au repo GitHub, 9 env vars prod (mêmes `ENCRYPTION_KEY`/`CRON_SECRET` que local — même DB), déployé + aliasé https://kua-locale.vercel.app. Piège rencontré : `echo | vercel env add` sous PowerShell ajoute un `\r` (erreur « whitespace in header ») — recréées via bash `printf '%s'`.
- GitHub Actions : secret `CRON_SECRET` posé; variable `APP_URL` volontairement absente (interrupteur d'activation une fois la service role key en place, sinon runs rouges aux 15 min).

### Phase 8 — Prod readiness (2026-07-02)
- `vercel.json` : 3 crons (sync-reviews */30, publish-posts */15, compute-due 1x/jour à 10 h UTC). Vercel injecte `CRON_SECRET` en header automatiquement.
- `/api/cron/compute-due` : log quotidien des compteurs dûs (`due_computed`, base des notifications futures) + découverte hebdomadaire (dimanche) pour rafraîchir les snapshots de fiches.
- `DEPLOY.md` : checklist ordonnée Supabase (migrations, bucket, seed prod minimal, auth) → Vercel (env vars avec pièges — `ENCRYPTION_KEY` immuable) → Google (Basic API Access, passage `GBP_MODE=real` sans changement de code) + smoke test mock + rollback.
- Smoke test réel non exécuté : aucun `.env.local` / projet Supabase sur cette machine (voir 🧍).

### Phase 7 — Polish & robustesse (2026-07-02)
- Command palette ⌘K (cmdk) : recherche client + navigation, câblée au bouton de la topbar.
- Sidebar : pastilles compteurs (reviews en attente, posts dus) alimentées par la vue board.
- Banners globaux : rouge « Connexion Google expirée » (status `revoked`), bleu « Accès API en attente d'approbation » (log `gbp_access_pending` < 24 h).
- Inbox reviews : toast undo sur « Ignorer » (action `unignoreReviewAction`), hint quand un draft a été régénéré ≥ 3 fois (enrichir le brand_profile), modal `?` des raccourcis clavier.
- Skeletons `loading.tsx` : app (kanban), reviews, posts, fiche client — jamais de spinner plein écran.
- Non fait (assumé) : micro-texte rotatif des boutons AI (statique « Rédaction… »), audit Lighthouse (impossible sans env branché — au smoke test de la phase 8).

### Phase 6 — Dashboard Kanban (2026-07-02)
- `/` : kanban d'états calculés sur la vue `client_board_state` — 4 colonnes priorisées (Reviews à répondre → Posts dus → En attente d'approbation → À jour), un client = une colonne, animations layout.
- Cartes : badges compteurs cliquables (→ onglet filtré de la fiche), pire note en attente, note moyenne + total d'avis, liseré rouge si retard (review > 72 h ou posts dus passé le 20), actions rapides au hover (Répondre / Générer).
- Header contextuel : compteurs globaux, CTA « Traiter les reviews (X) » sinon « Générer les posts dus (Y) », pastille sync (vert/rouge « Reconnexion requise »).
- Realtime : migration `20260702000002` (publication `supabase_realtime` sur reviews + posts) + `<RealtimeRefresh>` (router.refresh débouncé 400 ms).
- Fiche client `/clients/[id]` : 4 onglets URL-addressables (`?tab=`) — Aperçu (6 stats + activité récente), Reviews (ReviewsInbox réutilisé filtré), Posts (PostsView réutilisé mono-client), Réglages (cadence, langue, 2 toggles auto-publish avec avertissement, statut, `brand_profile` complet).
- `/clients` : liste des fiches (placeholder remplacé — la page indiquait « livré en phase 2 » à tort).

### Phase 5 — Module Posts (2026-07-02)
- `lib/due.ts` (+ 10 tests) : restants du mois, retard (> 20 du mois), suggestion de dates (réparties, jours de semaine, 10 h, fuseau America/Toronto sans dépendance — conversion itérative via `Intl`).
- `lib/ai/posts.ts` : prompt post mensuel de specs/07 (rotation d'angles via les 6 derniers posts, saison QC), parsing + limite 1500 chars, stub saisonnier sans clé.
- `lib/ai/images.ts` : génération Gemini (`gemini-2.5-flash-image`, surchargeable via `GEMINI_IMAGE_MODEL`), 2 tentatives, null sans clé → badge « image à ajouter ».
- `lib/posts/generate.ts` : orchestration contenu → image → sharp 1200×900 JPEG 85 → Storage `post-images/{client}/{post}.jpg` → draft (ou `scheduled` si `auto_publish_posts`).
- `lib/posts/publish.ts` : publication partagée cron + « Publier maintenant » (lock optimiste par statut, `REJECTED` → failed).
- `/api/cron/publish-posts` : posts `scheduled` échus + filet des réponses de reviews `approved` jamais parties.
- `/posts` : vue queue (Dus → Échecs → Brouillons → Planifiés → Publiés ce mois) + calendrier mensuel, batch « Générer tous les posts dus » séquentiel (500 ms) avec barre de progression.
- Éditeur `/posts/[id]` : split view formulaire + `<PostPreview>` fidèle Google temps réel, image régénérable avec directive ou remplaçable par upload, approuver/planifier/publier maintenant.
- Dépendance ajoutée : `sharp` (imposé par specs/06 pour le pipeline image).

### Phase 4 — Inbox Reviews (2026-07-02)
- `/reviews` complet (specs/05) : liste triée date desc, filtres statut (« En attente » par défaut) / client / note (4–5, 1–3), panneau de réponse inline (textarea éditable, compteur /4096).
- Actions : Publier (`putReviewReply` via Server Action, optimistic + rollback/toast), Régénérer avec directive optionnelle (réinjecte le draft précédent), Ignorer.
- Raccourcis clavier : `j`/`k` naviguer, `e` éditer, `⌘↵` publier, `Esc` fermer (légende dans la barre de filtres).
- Badges d'ancienneté (rouge si > 72 h en attente), badge « Avis modifié » (`was_updated`), animations Framer Motion (layout + fade des items traités).
- `<StarRating>` réutilisable (`components/reviews/`), empty state « Aucune review en attente 🎉 ».

### Phase 3 — Sync reviews + engine AI (2026-07-02)
- `lib/gbp/mapping.ts` : mapping GBP → ligne `reviews` + `decideSync` (insert/update/skip, `was_updated`, répondu-ailleurs) — fonctions pures, 12 tests.
- `lib/ai/` : `openai.ts` (fetch natif, timeout 30 s, 1 retry réseau/5xx, `response_format: json_object`), `prompts.ts` (gabarits specs/07), `parse.ts` (parsing défensif, 8 tests), `replies.ts` (draft + 1 retry de parse, stub déterministe sans clé, log `generation`).
- `/api/cron/sync-reviews` (GET, `Authorization: Bearer CRON_SECRET`) : clients actifs groupés par compte → `batchGetReviews` paginé → upsert → draft AI immédiat (`draft_ready`) → auto-publish ≥ 4★ si `auto_publish_replies` (échec → `approved` + `publish_error`).
- `GbpAccessPendingError` du batch → log `gbp_access_pending`, le sync continue sur les autres comptes.
- `.env.example` : `ANTHROPIC_API_KEY` → `OPENAI_API_KEY` + `OPENAI_MODEL`.

### Phase 2 — Couche GBP (2026-07-02)
- `lib/gbp/` : interface `GbpClient` + factory `getGbpClient()` (switch `GBP_MODE`), types GBP.
- `MockGbpClient` : fixtures réalistes (8 clients QC, ~40 reviews), latence simulée 300–800 ms, ~5 % d'échecs (`GBP_MOCK_FAILURES=0` pour désactiver).
- `RealGbpClient` : fetch natif, backoff exponentiel + jitter (5 essais), 429 persistant → `GbpAccessPendingError` (quota 0 / projet non approuvé).
- `lib/crypto.ts` : AES-256-GCM pour le refresh token (+ tests Vitest).
- `lib/google/token.ts` : cache mémoire jusqu'à expiry − 60 s, `invalid_grant` → connexion `revoked`.
- OAuth agence : `/api/google/connect` (state CSRF; en mock → connexion factice immédiate) + `/api/google/callback` (échange code, chiffrement, upsert, découverte).
- `lib/gbp/discovery.ts` : accounts.list → locations.list → upsert `clients` (nouvelles → active, disparues → disconnected, jamais supprimées).
- Page Réglages complète : état de connexion Google, resync, liste des fiches avec toggle actif/pause, gestion d'équipe (owner), défauts d'agence.
- Script `pnpm mock:new-review` : insère une review fake aléatoire sur un client actif.
- Fix : `Relationships: []` manquant sur la vue dans `lib/types/database.ts` (toutes les requêtes typaient `never`).

### Phase 1 — Auth app + données (2026-07-01)
- Supabase Auth (Google + email/password), middleware de session, whitelist `agency_members` (AccessDenied si non listé), page login stylée.
- `lib/auth.ts` : `getSessionContext()` (session + whitelist, cache par render).
- Types TS de la base écrits à la main dans `lib/types/database.ts` (pas de stack locale pour `gen types`).

### Phase 0 — Fondations (2026-07-01, en cours)
- Repo git initialisé (`main`), specs déplacées dans `specs/`.
- Next.js 15.5 + TS + Tailwind 4 + shadcn/ui (21 composants) scaffoldé à la racine.
- Design system Küa appliqué : tokens dark de specs/09 dans `globals.css` (dark-only, `color-scheme: dark`), Inter via `next/font`.
- Shell app : sidebar 240px + topbar (badge MODE DÉMO) + route groups `(auth)`/`(app)` + 6 pages placeholder.
- Config : `.env.example` complet, Vitest + premier test, Prettier, scripts pnpm (`test`, `typecheck`, `format`).
- Supabase : `supabase init`, migration `20260701000001_init.sql` (8 tables, triggers, index, vue `client_board_state`, RLS, bucket `post-images`), `seed.sql` (1 agence, 2 membres, 8 clients QC, 40 reviews, 4 posts).
