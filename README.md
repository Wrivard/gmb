# Küa Locale

Application interne de l'agence Küa pour gérer les Google Business Profiles de ~30 clients : réponses AI aux reviews, posts mensuels générés (texte + image), dashboard kanban.

- **Specs** : `specs/` (source de vérité) — commencer par `specs/README.md`.
- **Avancement** : `PROGRESS.md` (journal du build autonome).
- **Stack** : Next.js 15 · Supabase · Tailwind 4 + shadcn/ui · Anthropic (texte) · Gemini (images) · Vercel.

## Démarrage

```bash
pnpm install
cp .env.example .env.local   # remplir les variables
pnpm dev
```

Par défaut `GBP_MODE=mock` : aucune clé Google requise, l'app tourne sur des données mock réalistes (8 clients québécois). Voir `specs/04-GOOGLE-API.md`.

## Scripts

| Script | Rôle |
|---|---|
| `pnpm dev` | Dev server (Turbopack) |
| `pnpm build` / `pnpm start` | Build et serve production |
| `pnpm lint` / `pnpm typecheck` | ESLint / TypeScript |
| `pnpm test` | Vitest |
| `pnpm exec supabase start` | Stack Supabase locale (Docker requis) |
