# 10 — Plan de build (protocole de loop autonome)

## Protocole de loop

Claude Code travaille en boucle continue, phase par phase, SANS intervention humaine sauf aux points marqués 🧍. Règles :

1. **Une phase = un cycle complet** : implémenter → vérifier (build + lint + tests + smoke) → committer → mettre à jour `PROGRESS.md` → phase suivante.
2. **`PROGRESS.md` à la racine** : journal de bord. À chaque phase : ce qui est fait, les décisions prises (avec justification 1 ligne), ce qui reste, les blocages. C'est la mémoire entre les sessions — le lire en PREMIER à chaque reprise.
3. **Décisions autonomes.** En cas d'ambiguïté : prendre la décision la plus raisonnable alignée avec les specs, la documenter dans `PROGRESS.md` sous « Décisions », continuer. Ne JAMAIS s'arrêter pour poser une question si une hypothèse raisonnable existe.
4. **Vérification obligatoire avant chaque commit** : `pnpm build` passe, `pnpm lint` passe, `pnpm test` passe (Vitest sur la logique critique : `lib/due.ts`, `lib/crypto.ts`, parsing AI, mapping des reviews). Un commit qui casse le build est interdit.
5. **Commits atomiques** en français : `feat: inbox reviews avec quick reply`, `fix: ...`.
6. **Mode mock par défaut.** Ne jamais exiger de vraies clés Google pour avancer. Tout ce qui touche Google passe par l'interface `GbpClient`.
7. Si une dépendance externe bloque (clé manquante, etc.) : stubber, noter dans `PROGRESS.md` section « 🧍 Requis de William », et continuer sur autre chose.

## Phases

### Phase 0 — Fondations
Init Next.js 15 + TS + Tailwind 4 + shadcn/ui (dark, tokens de `09`), ESLint/Prettier, Vitest, structure de dossiers de `01`, `.env.example` complet, `PROGRESS.md`, layout de base (sidebar/topbar) avec pages placeholder. Supabase : projet local (`supabase init`), migration 001 = schéma complet de `03` + seed mock.

### Phase 1 — Auth app + données
Supabase Auth (login Google + email), middleware, whitelist `agency_members`, page login stylée. RLS. Types TS générés depuis le schéma.

### Phase 2 — Couche GBP (mock + real)
Interface `GbpClient`, `MockGbpClient` complet avec fixtures réalistes (8 clients QC, ~40 reviews), `RealGbpClient` avec token manager, backoff, erreur typée `GbpAccessPendingError`. Flow OAuth `/api/google/connect` + callback + chiffrement + découverte des locations. Page Settings avec état de connexion et liste des fiches. Script `pnpm mock:new-review`.

### Phase 3 — Sync reviews + engine AI réponses
Cron `sync-reviews` (logique complète de `04`), `lib/ai/replies.ts` + prompts de `07`, génération auto des drafts à l'import. Tests sur le mapping et le parsing.

### Phase 4 — Inbox Reviews (UI)
`/reviews` complet selon `05` : liste, filtres, panneau inline, publier/éditer/régénérer avec directive/ignorer, optimistic updates, raccourcis clavier, badges d'ancienneté. Publication via Server Action → `GbpClient.putReviewReply`.

### Phase 5 — Module Posts
`lib/due.ts` (+ tests), génération de posts (`lib/ai/posts.ts`, `images.ts` avec Gemini + fallback placeholder si pas de clé), pipeline image (sharp → 1200×900 → Storage), `/posts` (queue + calendrier), éditeur avec `<PostPreview>`, scheduler cron `publish-posts`, action batch « générer tous les posts dus ».

### Phase 6 — Dashboard Kanban
Vue `client_board_state`, page `/` selon `08`, cartes, priorités, Realtime, header contextuel. Fiche client `/clients/[id]` (4 onglets, incluant l'éditeur de `brand_profile`).

### Phase 7 — Polish & robustesse
Micro-interactions de `09` (animations, skeletons, toasts undo, command palette, empty states), activity log visible, gestion des états d'erreur (connexion révoquée, accès API pending, post rejeté), audit accessibilité/perf, revue complète de chaque écran contre les specs.

### Phase 8 — Prod readiness 🧍
`vercel.json` (crons + `CRON_SECRET`), doc de déploiement `DEPLOY.md` (checklist : Supabase prod ca-central-1, buckets, env vars Vercel, redirect URI prod, passage `GBP_MODE=real` après approbation Google). Smoke test final en mock. Lister dans `PROGRESS.md` tout ce qui attend William (clés, approbation Google, domaine).

## Definition of done (globale)

- Un membre de l'équipe peut, en mode mock : se connecter → voir le kanban avec les 8 clients mock → répondre à toutes les reviews en attente en < 2 min via les drafts AI → générer, réviser et planifier les posts dus → voir le kanban devenir tout vert.
- `GBP_MODE=real` ne demande AUCUN changement de code — seulement des env vars.
- Build, lint, tests verts. `PROGRESS.md` et `DEPLOY.md` à jour.
