---
name: verify
description: Recette de vérification runtime locale de Küa Locale — lancer le dev server, s'authentifier avec le compte de service cron, piloter pages/crons/actions et observer les effets en base Supabase.
---

# Vérifier Küa Locale en local

## Lancer

```bash
pnpm dev   # Next 15 turbopack, port 3000, prêt en ~5 s
```

`.env.local` pointe sur le projet Supabase `kua-locale` (czugrjtabomdngbxzhhr) — c'est la même base que la prod (app mock-first, données démo QC). GBP_MODE=mock.

## Surfaces et handles

- **Pages non authentifiées** : `GET /login` → 200; `GET /` → 307 vers `/login?next=%2F` (middleware).
- **Crons** : `curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/{sync-reviews,publish-posts,compute-due}` (CRON_SECRET dans `.env.local`). Sans header → 401. Réponses JSON à compteurs.
- **Pages authentifiées** : fabriquer un cookie de session avec le compte de service (`CRON_SERVICE_EMAIL`/`CRON_SERVICE_PASSWORD`, whitelisté membre) :
  1. `POST {SUPABASE_URL}/auth/v1/token?grant_type=password` (header `apikey: <anon key>`) → session JSON.
  2. Cookie `sb-czugrjtabomdngbxzhhr-auth-token` = `base64-` + base64url(JSON session) (chunker en `.0`, `.1`… si > 3180 chars — en pratique 1 chunk suffit).
  3. `curl -H "Cookie: ..."` sur `/`, `/posts`, `/reviews`, `/clients`, `/clients/<id>?tab={apercu,reviews,posts,settings}`. Vérifier l'absence de « MODE DÉMO » (sinon on est sur la branche fixtures).
- **Server actions en curl** (ex. générer un post) : trouver l'ID d'action dans les chunks JS (`grep generatePostAction` sur les `/_next/static/chunks/*.js` référencés par la page), puis
  `POST /posts` avec `Next-Action: <id>`, `Content-Type: text/plain;charset=utf-8`, body `'["<clientId>"]'`. Réponse RSC : chercher `{"ok":...}`. ~35 s si image AI (coût réel OpenAI ~0,06 $/image).
- **Effets en base** : MCP Supabase `execute_sql` sur le projet `czugrjtabomdngbxzhhr` (posts, review_replies, activity_log — `activity_log` trace modèle + tokens des générations AI).
- **Image d'un post** : URL publique `https://czugrjtabomdngbxzhhr.supabase.co/storage/v1/object/public/post-images/<client_id>/<post_id>.jpg` → 200 image/jpeg 1200×900.

## Flows qui valent la peine

- Forcer le chemin d'import d'une review : `delete from reviews where gbp_review_id='rev-…'` puis relancer sync-reviews → `imported:1, drafts:1` (draft OpenAI réel si clé active, sinon stub `generated_by_ai=false`).
- Chemins d'échec GBP en mock : `[mock:rejected]`/`[mock:processing]` dans le texte d'un post, `[mock:fail]` dans une réponse d'avis (déterministes).
- Concordance cadence : « Générer tous les posts dus (N) » sur `/posts` doit égaler `postsDue` de compute-due (JS vs vue SQL).

## Pièges

- Les générations de test créent de vrais drafts (et images payantes) dans la base partagée — les nettoyer ou les signaler.
- `GBP_MOCK_FAILURES=1` par défaut : ~5 % d'échecs aléatoires simulés; mettre à 0 pour des runs déterministes.
- Les fixtures mock étant statiques, un 2e sync consécutif ne fait que des skips — c'est le comportement attendu, pas un bug.
