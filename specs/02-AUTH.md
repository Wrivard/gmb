# 02 — Authentification

Deux systèmes distincts. Ne pas les mélanger.

## A. Auth de l'application (l'équipe Küa se connecte)

- **Supabase Auth**, provider Google (`signInWithOAuth`) + fallback email/password.
- Cette connexion sert UNIQUEMENT à identifier les membres de l'équipe. Elle ne demande PAS le scope `business.manage`.
- Whitelist : seuls les emails présents dans la table `agency_members` peuvent accéder à l'app. Un trigger/middleware bloque les autres après login avec un message clair.
- Middleware Next.js : toute route sous `(app)` exige une session; sinon redirect `/login`.
- Rôles : `owner` (gère l'équipe + la connexion Google) et `member` (tout le reste). Simple.

## B. Connexion Google de l'agence (accès aux GBP des clients)

C'est LA connexion plug-and-play demandée : l'agence connecte une fois son compte Google manager, et toutes les fiches clients apparaissent.

### Flow OAuth (custom, PAS via Supabase Auth)

Raison : on a besoin d'un **refresh token offline** longue durée avec le scope `business.manage`, stocké et réutilisé par les crons — indépendant des sessions utilisateur.

1. `GET /api/google/connect` → redirect vers `https://accounts.google.com/o/oauth2/v2/auth` avec :
   - `scope=https://www.googleapis.com/auth/business.manage`
   - `access_type=offline`
   - `prompt=consent` (force l'émission d'un refresh token)
   - `state` = token CSRF signé stocké en cookie httpOnly.
2. `GET /api/google/callback` :
   - Vérifie `state`.
   - Échange le `code` contre `{ access_token, refresh_token, expiry }` via `https://oauth2.googleapis.com/token`.
   - Chiffre le refresh token (AES-256-GCM, `lib/crypto.ts`) et upsert dans `google_connections` (une seule connexion active par agence).
   - Lance immédiatement la **découverte** (voir C) puis redirect vers `/settings?connected=1`.

### Gestion des tokens

- `lib/google/token.ts` : `getAccessToken()` → décrypte le refresh token, échange contre un access token, cache en mémoire jusqu'à expiry - 60s.
- Si le refresh échoue avec `invalid_grant` (token révoqué) : marquer la connexion `status='revoked'`, afficher un banner rouge dans toute l'app « Connexion Google expirée — reconnecter », et suspendre les crons de publication.

## C. Découverte automatique des clients (plug-and-play)

Au moment de la connexion (et via un bouton « Resynchroniser les fiches » dans Settings) :

1. `accounts.list` (Account Management API v1) → tous les comptes accessibles (compte perso + comptes organisation/location groups).
2. Pour chaque compte : `locations.list` (Business Information API v1) avec `readMask=name,title,storefrontAddress,categories,phoneNumbers,websiteUri,metadata`.
3. Upsert chaque location dans la table `clients` :
   - Nouvelle location → créée avec `status='active'`, cadence par défaut (2 posts/mois), nom = `title` de la fiche.
   - Location disparue (accès retiré) → `status='disconnected'` (jamais supprimée; l'historique reste).
4. L'UI Settings liste les fiches découvertes avec un toggle actif/inactif (un client inactif n'apparaît pas dans le kanban et n'est pas syncé).

En `GBP_MODE=mock`, la découverte retourne ~8 clients fictifs réalistes (toiture, garage, paysagement, resto, etc. — noms québécois) depuis les fixtures.
