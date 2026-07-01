# Küa Locale — Plateforme de gestion Google Business Profile

> Spec suite complète pour build autonome via Claude Code. Lire ce fichier en premier, puis suivre `10-PLAN-DE-BUILD.md`.

## C'est quoi

Application web interne pour l'agence Küa. Permet à l'équipe de gérer les fiches Google Business Profile (GBP, anciennement Google My Business) de ~30 clients à partir d'un seul dashboard :

1. **Reviews** — voir toutes les nouvelles reviews des clients, générer une réponse AI optimale en un clic (quick reply), approuver, publier directement sur Google.
2. **Posts** — générer des publications GBP mensuelles (texte AI + image AI), les planifier, les publier automatiquement selon la cadence configurée par client (ex : 2 posts/mois).
3. **Dashboard Kanban** — vue d'ensemble de tous les clients : qui a des reviews non répondues, qui est dû pour un post, qui est à jour.

L'agence se connecte **une seule fois** avec son compte Google (celui qui a les accès manager sur toutes les fiches clients) et l'app découvre automatiquement toutes les locations. Plug-and-play.

## Stack (décisions finales — ne pas remettre en question)

| Couche | Choix | Pourquoi |
|---|---|---|
| Framework | Next.js 15 (App Router, TypeScript) | Standard Küa |
| DB / Auth / Storage | Supabase (région `ca-central-1`) | Standard Küa, données au Canada |
| Hosting | Vercel (+ Vercel Cron pour les jobs) | Standard Küa |
| UI | Tailwind CSS 4 + shadcn/ui + lucide-react | Dark premium Küa |
| AI texte | Anthropic API — `claude-sonnet-4-6` | Réponses reviews + textes de posts |
| AI image | Google Gemini API — modèle image (Imagen / gemini-flash-image) | Images des posts, même écosystème Google |
| API Google | GBP APIs (v1 + v4 legacy) | Voir `04-GOOGLE-API.md` |

## Index des documents

| Fichier | Contenu |
|---|---|
| `00-PREREQUIS-GOOGLE.md` | ⚠️ CHEMIN CRITIQUE — demande d'accès à la GBP API, setup GCP, OAuth consent. Actions humaines requises AVANT/PENDANT le build. |
| `01-ARCHITECTURE.md` | Architecture système, structure du repo, variables d'environnement |
| `02-AUTH.md` | Auth de l'app (Supabase) + connexion Google de l'agence (OAuth, refresh tokens) |
| `03-DATABASE.md` | Schéma Postgres complet, RLS, migrations |
| `04-GOOGLE-API.md` | Tous les endpoints GBP, sync des reviews, publication des posts, quotas, mocks |
| `05-MODULE-REVIEWS.md` | Inbox reviews, workflow quick reply AI, guidelines de réponse (basées sur recherche) |
| `06-MODULE-POSTS.md` | Cadence, scheduler, génération de posts, hosting des images |
| `07-AI-ENGINE.md` | Prompts complets (réponses + posts + images), profils de marque par client |
| `08-DASHBOARD-KANBAN.md` | Kanban board, logique de statuts, logique de "dû" |
| `09-FRONTEND-DESIGN.md` | Design system Küa dark premium, écrans, interactions |
| `10-PLAN-DE-BUILD.md` | Phases de build, definition of done, protocole de loop autonome |
| `PROMPT-INITIAL.md` | Le premier prompt à donner à Claude Code |

## Principes non négociables

1. **Mock-first.** L'accès à la GBP API prend des jours/semaines à être approuvé. TOUT doit être développé contre une couche mock (`GBP_MODE=mock`) avec des données réalistes. Le switch vers l'API réelle est une variable d'environnement, zéro changement de code.
2. **L'humain approuve, l'AI propose.** Aucune réponse de review ni aucun post n'est publié sur Google sans approbation explicite dans l'UI (sauf si le client est configuré en `auto_publish` — off par défaut).
3. **Frontend premium.** Dark, minimal, réactif (optimistic updates partout). C'est le critère #1 de qualité. Voir `09-FRONTEND-DESIGN.md`.
4. **Français québécois** dans toute l'UI. Le contenu généré (réponses, posts) est en français par défaut, configurable par client.
5. **Production-ready.** Gestion d'erreurs, retry avec backoff exponentiel sur les 429, logs d'activité, tokens chiffrés.
