# PROGRESS — Küa Locale

> Journal de bord du build autonome. **À relire en premier à chaque reprise de session.**
> Protocole : specs/10-PLAN-DE-BUILD.md. Source de vérité : specs/.

## État courant

- **Phase active : 0 — Fondations (en cours)**
- Prochain jalon : vérifier build/lint/test, commit initial, puis Phase 1.

## Phases

- [ ] **Phase 0 — Fondations** ← en cours
- [ ] Phase 1 — Auth app + données
- [ ] Phase 2 — Couche GBP (mock + real)
- [ ] Phase 3 — Sync reviews + engine AI réponses
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
| 9 | Engine AI = API Anthropic avec `ANTHROPIC_API_KEY` (stack imposé par specs/README) | Décision de stack explicite de la spec (« ne pas remettre en question »). Fallback stub tant que la clé manque. |

## 🧍 Requis de William

- [ ] Checklist Google complète de `specs/00-PREREQUIS-GOOGLE.md` (projet GCP, APIs, OAuth consent, client ID, demande Basic API Access).
- [ ] Clé `ANTHROPIC_API_KEY` (engine réponses/posts — stub en attendant).
- [ ] Clé `GEMINI_API_KEY` (images de posts — placeholder en attendant).
- [ ] Projet Supabase prod (région `ca-central-1`) au moment du déploiement (Phase 8).
- [ ] Docker Desktop lancé si tu veux `supabase start` en local (sinon l'app tourne contre un projet Supabase distant).

## Journal

### Phase 0 — Fondations (2026-07-01, en cours)
- Repo git initialisé (`main`), specs déplacées dans `specs/`.
- Next.js 15.5 + TS + Tailwind 4 + shadcn/ui (21 composants) scaffoldé à la racine.
- Design system Küa appliqué : tokens dark de specs/09 dans `globals.css` (dark-only, `color-scheme: dark`), Inter via `next/font`.
- Shell app : sidebar 240px + topbar (badge MODE DÉMO) + route groups `(auth)`/`(app)` + 6 pages placeholder.
- Config : `.env.example` complet, Vitest + premier test, Prettier, scripts pnpm (`test`, `typecheck`, `format`).
- Supabase : `supabase init`, migration `20260701000001_init.sql` (8 tables, triggers, index, vue `client_board_state`, RLS, bucket `post-images`), `seed.sql` (1 agence, 2 membres, 8 clients QC, 40 reviews, 4 posts).
