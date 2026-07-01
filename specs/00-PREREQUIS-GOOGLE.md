# 00 — Prérequis Google (⚠️ CHEMIN CRITIQUE)

Ce document décrit ce que **William (humain)** doit faire côté Google, et ce que **Claude Code** doit préparer côté code. Le build n'attend PAS l'approbation Google : tout se développe en mode mock (voir `04-GOOGLE-API.md`).

## 1. La réalité de la GBP API (important à comprendre)

- Les APIs Google Business Profile ne sont **pas ouvertes au public**. Il faut soumettre une demande d'accès ("Application for Basic API Access") et être approuvé manuellement par Google.
- Tant que le projet GCP n'est pas approuvé, le quota est **0 QPM** : chaque appel retourne un `429 RESOURCE_EXHAUSTED` même au premier appel. Ce n'est pas un rate limit, c'est le signal que l'accès n'est pas encore accordé. Ne PAS demander une augmentation de quota dans ce cas — il faut soumettre le formulaire d'accès.
- Une fois approuvé : quota standard de **300 QPM** par API, et max **10 éditions/minute par fiche**. Largement suffisant pour ~30 clients.
- L'approbation prend de **quelques jours à quelques semaines**. Aucun sandbox n'existe.
- L'accès est accordé **par projet GCP** (pas par compte Google). Avoir accès à d'autres APIs Google (Ads, etc.) ne transfère pas.

## 2. Checklist humaine (William) — à faire dès maintenant

1. **Créer un projet GCP dédié** (ex : `kua-locale`) avec le compte Google de l'agence — celui qui a les accès manager/owner sur les fiches GBP des clients. Noter le **project number**.
2. **Activer les APIs** dans le projet (APIs & Services → Enable) :
   - My Business Account Management API
   - My Business Business Information API
   - Google My Business API (v4 — reviews + local posts)
   - My Business Notifications API (optionnel, pour Pub/Sub)
3. **Configurer l'écran de consentement OAuth** :
   - Type : Internal si Google Workspace, sinon External.
   - Scopes : `https://www.googleapis.com/auth/business.manage`
   - App name, logo Küa, lien vers politique de confidentialité sur kua.quebec (**requis** — le formulaire de demande vérifie que le site a une privacy policy visible).
   - Ajouter ton email comme test user (permet de tester le flow OAuth avant vérification complète).
4. **Créer un OAuth Client ID** (type Web application) :
   - Redirect URIs : `http://localhost:3000/api/google/callback` et `https://<domaine-prod>/api/google/callback`
   - Récupérer `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET`.
5. **Soumettre la demande d'accès Basic API Access** via le formulaire GBP (lié depuis la page "Prerequisites" de la doc Business Profile APIs) :
   - Utiliser un email `@kua.quebec` — **le domaine de l'email DOIT matcher le domaine du site web** fourni, sinon rejet quasi automatique.
   - Fournir le project number GCP exact du projet où les APIs sont activées.
   - Use case précis, pas vague. Exemple à adapter : *« Küa is a Quebec-based marketing agency managing Google Business Profiles for ~30 SMB clients (construction, roofing, automotive, trades) as authorized manager. We are building an internal dashboard to reply to customer reviews and publish monthly Local Posts on behalf of our clients, using the Reviews API and LocalPosts API. »*
   - La fiche GBP de Küa elle-même devrait être vérifiée et âgée de 60+ jours.
6. **(Optionnel, recommandé)** Créer un **compte Organisation GBP** pour l'agence si pas déjà fait — c'est le modèle recommandé par Google pour les partenaires qui gèrent des fiches pour des tiers.
7. **Clés AI** : créer une clé Anthropic API (`ANTHROPIC_API_KEY`) et une clé Gemini API (`GEMINI_API_KEY`).

## 3. Comment savoir si c'est approuvé

- GCP Console → IAM & Admin → Quotas → filtrer sur les APIs Business Profile.
- Quota `0 QPM` = pas encore approuvé. Quota `300 QPM` = approuvé.
- Google envoie aussi un courriel de confirmation.

## 4. Côté code (Claude Code)

- Implémenter tout le client Google derrière une interface (`lib/gbp/client.ts`) avec deux implémentations : `MockGbpClient` et `RealGbpClient`, sélectionnées par `GBP_MODE=mock|real`.
- Le flow OAuth complet (connexion, callback, stockage du refresh token) **fonctionne même sans approbation API** — le construire et le tester dès la phase 2.
- Gérer explicitement le cas `429 quota 0` dans `RealGbpClient` : afficher dans l'UI un état « Accès API Google en attente d'approbation » plutôt qu'une erreur brute.
- Retry avec backoff exponentiel + jitter sur les 429 réels (post-approbation).
