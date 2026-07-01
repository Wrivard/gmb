# 05 — Module Reviews (Quick Reply AI)

## Objectif

Zéro friction : l'équipe ouvre l'app, voit les reviews en attente avec un **draft AI déjà généré**, lit, ajuste au besoin, clique « Publier ». 10 secondes par review dans le cas nominal.

## Workflow d'une review

```
[sync] nouvelle review détectée
   → status: needs_reply
   → génération AI automatique du draft (background, dans le cron de sync)
   → status: draft_ready
[humain] ouvre l'inbox
   → lit le draft → options :
      a) Publier tel quel        → approved → (cron ou action directe) → replied
      b) Éditer puis publier     → idem, published_text = version éditée
      c) Régénérer (avec directive optionnelle : « plus court », « mentionne la garantie »…)
      d) Ignorer                 → ignored (reviews spam / rating-only si voulu)
```

- « Publier » fait l'appel `putReviewReply` immédiatement (Server Action) avec état optimiste dans l'UI; le cron sert de filet pour les `approved` non publiés (retry).
- Si `auto_publish_replies=true` sur le client **ET** rating ≥ 4 : publication automatique du draft sans humain. Les reviews ≤ 3 étoiles exigent TOUJOURS une approbation humaine, même en auto.

## UI — Inbox Reviews (`/reviews`)

- Liste style inbox, triée par date desc, filtres : client, rating (1–3 / 4–5), statut, non-répondues seulement (défaut).
- Chaque item : avatar + nom du reviewer, étoiles (composant visuel), texte de la review, badge client, ancienneté (« il y a 2 jours » — les réponses devraient partir en < 72 h, badge rouge si > 72 h).
- Panneau de réponse inline (pas de navigation) : draft AI dans un textarea éditable, compteur de caractères, boutons **Publier**, **Régénérer** (avec champ directive optionnel), **Ignorer**.
- Raccourcis clavier : `j/k` naviguer, `e` éditer, `Cmd+Enter` publier.
- Vue par client identique dans `/clients/[id]` (onglet Reviews, avec historique complet incluant `replied`).

## Guidelines de réponse (encodées dans le prompt AI — voir `07-AI-ENGINE.md`)

Basées sur les meilleures pratiques documentées (Google + recherche SEO local) :

**Universel**
1. Répondre à TOUTES les reviews, positives comme négatives — l'engagement est un signal de prominence pour le ranking local et améliore la conversion.
2. Répondre vite (cible < 24–72 h) — d'où le sync aux 30 min + le badge d'ancienneté.
3. Personnaliser : saluer le reviewer par son prénom, référencer un détail spécifique de son commentaire. Jamais deux réponses identiques.
4. Mentionner naturellement le service et la ville quand ça coule de source (« Merci d'avoir fait confiance à notre équipe pour votre toiture à Laval ») — renforce la pertinence locale. **Jamais** de keyword stuffing : max une mention service+ville par réponse, et seulement si naturel.
5. Signer au nom de l'entreprise (ex : « — L'équipe Toitures Bergeron »).
6. Langue = langue de la review (review en anglais → réponse en anglais), sinon défaut du client.

**Reviews positives (4–5 ★)** : courtes (2–4 phrases), chaleureuses, remercier, reprendre un élément précis, inviter à revenir. Pas de sur-vente.

**Reviews négatives (1–3 ★)** : structure fixe —
1. Remercier pour le feedback + empathie sincère (sans platitudes corporatives).
2. Ne JAMAIS argumenter, blâmer le client, ou admettre une faute légale. Rester factuel et calme.
3. Proposer de régler hors ligne : « Contactez-nous au {téléphone} pour qu'on trouve une solution. »
4. Montrer (brièvement) que le feedback sert à s'améliorer.
5. Ton posé, professionnel, humain. 3–5 phrases max.

**Reviews sans commentaire (rating only)** : réponse très courte (1–2 phrases) pour les 5★; les 1★ sans texte → draft neutre proposant le contact; possibilité d'ignorer.

## Notes qualité AI

- Le draft passe par une **auto-vérification** : le modèle relit sa propre réponse contre une checklist (pas de promesse non tenable, pas de mention de compensation/remboursement, pas d'info inventée, longueur OK) avant de retourner. Une seule passe, dans le même appel (voir prompt).
- `generation_count` trackée; si un draft est régénéré 3+ fois régulièrement pour un client, c'est un signal que son `brand_profile` doit être enrichi (afficher un hint dans l'UI).
