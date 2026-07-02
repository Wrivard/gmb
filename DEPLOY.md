# DEPLOY — Küa Locale

Checklist de mise en production. Ordre recommandé : Supabase → Vercel → Google.

## 1. Supabase (prod)

1. Créer un projet Supabase, **région `ca-central-1`** (données au Canada).
2. Lier et pousser les migrations :
   ```bash
   pnpm exec supabase link --project-ref <ref>
   pnpm exec supabase db push
   ```
3. Vérifier que le bucket **`post-images`** existe et est **public** (créé par la migration 001 — Google doit pouvoir fetcher les images).
4. **Seed minimal de prod** (PAS `seed.sql`, qui est du mock) : insérer l'agence et la whitelist :
   ```sql
   insert into public.agencies (name) values ('Küa');
   insert into public.agency_members (agency_id, email, role)
   values ((select id from public.agencies limit 1), 'wrivard@kua.quebec', 'owner');
   -- + un insert par membre de l'équipe
   ```
5. Auth → Providers : activer **Google** (client ID/secret — peut être le même projet GCP que la connexion agence) et **Email**.
6. Auth → URL Configuration : `Site URL` = URL prod; ajouter `https://<domaine>/auth/callback` aux Redirect URLs.

## 2. Vercel

1. Importer le repo `Wrivard/gmb`. Framework : Next.js (zéro config, `vercel.json` porte les crons).
2. Variables d'environnement (toutes celles de `.env.example`) :

   | Variable | Valeur |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | du projet Supabase prod |
   | `SUPABASE_SERVICE_ROLE_KEY` | ⚠️ secret — service role |
   | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | du projet GCP (voir §3) |
   | `GOOGLE_REDIRECT_URI` | `https://<domaine>/api/google/callback` |
   | `GBP_MODE` + `NEXT_PUBLIC_GBP_MODE` | `mock` au départ; `real` après approbation Google (§3) — **aucun changement de code** |
   | `GBP_MOCK_FAILURES` | `0` en prod tant qu'on est en mock |
   | `OPENAI_API_KEY` | clé OpenAI (drafts de réponses + posts) |
   | `OPENAI_MODEL` | optionnel — défaut `gpt-4.1-mini` |
   | `GEMINI_API_KEY` | clé Gemini (images de posts) |
   | `ENCRYPTION_KEY` | `openssl rand -hex 32` — ⚠️ ne JAMAIS changer après la première connexion Google (les refresh tokens chiffrés deviendraient illisibles) |
   | `CRON_SECRET` | `openssl rand -hex 32` — Vercel l'injecte automatiquement en header `Authorization: Bearer` sur les crons |
   | `NEXT_PUBLIC_APP_URL` | `https://<domaine>` |

3. Crons (déclarés dans `vercel.json`) : sync-reviews aux 30 min, publish-posts aux 15 min, compute-due 1x/jour. Vérifier dans l'onglet Crons après le premier déploiement.

## 3. Google Cloud (checklist complète : specs/00-PREREQUIS-GOOGLE.md)

1. Projet GCP + activer les 3 APIs (Account Management, Business Information, GMB v4 legacy).
2. OAuth consent screen (interne ou externe publié) + client OAuth **Web** avec redirect URIs :
   - `https://<domaine>/api/google/callback` (prod)
   - `http://localhost:3000/api/google/callback` (dev)
3. **Demander le Basic API Access** (formulaire GBP) — sans approbation, quota 0 → l'app affiche le banner « accès en attente ».
4. Une fois approuvé : passer `GBP_MODE=real` + `NEXT_PUBLIC_GBP_MODE=real` sur Vercel, redéployer, puis Réglages → « Connecter Google » avec le compte manager de l'agence.

## 4. Smoke test (en mock, avant `real`)

1. Login avec un compte whitelisté → dashboard s'affiche.
2. Réglages → « Connecter Google » (mock = connexion factice) → 8 clients QC apparaissent.
3. Lancer un sync manuellement : `curl -H "Authorization: Bearer $CRON_SECRET" https://<domaine>/api/cron/sync-reviews` → reviews importées avec drafts.
4. `/reviews` : publier un draft, régénérer avec directive, ignorer + undo.
5. `/posts` : « Générer tous les posts dus » → drafts avec dates suggérées; approuver → `curl .../api/cron/publish-posts` → publié.
6. Kanban : les cartes bougent au fil des actions; `pnpm mock:new-review` (en local) fait apparaître une review en temps réel.

## Rollback

Vercel → Deployments → « Promote to Production » sur le déploiement précédent. Les migrations Supabase ne se rollbackent pas automatiquement — écrire une migration inverse au besoin.
