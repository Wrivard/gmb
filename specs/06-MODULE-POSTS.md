# 06 — Module Posts (publications GBP mensuelles)

## Objectif

Chaque client a une cadence (ex : 2 posts/mois). L'app sait qui est « dû », génère le post complet (texte + image AI + CTA), l'équipe approuve, l'app publie à la date planifiée. Le travail humain se réduit à : lire, ajuster si besoin, approuver.

## Logique de « dû » (`lib/due.ts`)

Pour un client actif au mois courant (fuseau `America/Toronto`) :

```
publiés_ce_mois   = posts status='published' && published_at dans le mois
planifiés_ce_mois = posts status IN ('scheduled','approved') && scheduled_for dans le mois
restants          = max(0, posts_per_month - publiés - planifiés)
```

- `restants > 0` → le client est **dû** (apparaît dans la colonne kanban « Posts dus »).
- Urgence : si on est passé le 20 du mois et `restants > 0` → badge rouge « en retard ».
- Suggestion de dates : répartir uniformément ce qui reste dans le mois (ex : 2 posts → ~le 10 et ~le 24), jours de semaine, 10h00 ET par défaut.

## Workflow d'un post

```
[humain] clique « Générer le post » sur un client dû (ou « Générer tous les posts dus » — action batch)
   → AI génère : summary + cta + prompt d'image → génération de l'image (Gemini)
   → image uploadée dans Storage, post créé status='draft', scheduled_for = date suggérée
[humain] révise dans l'éditeur de post :
   - texte éditable, image régénérable (avec directive) ou remplaçable par upload manuel
   - date/heure modifiable (datetime picker)
   - Approuver → status='approved' puis 'scheduled'
[cron publish-posts] scheduled_for atteint → publie via LocalPosts API → 'published'
```

- « Publier maintenant » disponible aussi (bypass le scheduler).
- `auto_publish_posts=true` sur un client → les posts générés passent directement en `scheduled` sans approbation (off par défaut).
- Échec de publication (`REJECTED` par la modération Google, image inaccessible, etc.) → `failed` + raison lisible + bouton « Réessayer » / « Modifier ».

## Contenu des posts (règles pour l'AI — détails dans `07-AI-ENGINE.md`)

- `summary` : 80–250 mots max ~1500 caractères (limite API). Structure : accroche → valeur concrète (conseil saisonnier, service mis de l'avant, réalisation récente) → appel à l'action doux. Ton du `brand_profile`.
- Angles rotatifs pour éviter la répétition (l'AI reçoit les 6 derniers posts du client et doit varier) : conseil saisonnier lié au métier, mise en avant d'un service, « pourquoi nous », rappel pratique (soumission gratuite, etc.), actualité locale du métier.
- Saisonnalité québécoise intégrée (déneigement, pneus d'hiver, Fêtes, printemps/gouttières, etc. selon le vertical).
- CTA : `LEARN_MORE` → site du client par défaut; `CALL` si pas de site.
- Pas d'émojis excessifs (max 1–2), pas de hashtags (inutiles sur GBP), pas de prix précis inventés, pas de promotions inventées.

## Images AI

- Génération via Gemini API (modèle image), prompt construit par Claude en même temps que le texte (champ `image_prompt` en anglais, descriptif, photographique).
- Style : photo réaliste liée au métier et à la saison, **sans texte incrusté** (le texte rendu par les modèles d'image est peu fiable), sans logos, sans visages en gros plan (évite l'uncanny), lumière naturelle, esthétique premium sobre.
- Format : générer en 4:3, redimensionner/recadrer à **1200×900**, encoder JPEG qualité 85 (sharp), uploader `post-images/{client_id}/{post_id}.jpg`.
- Fallback : si la génération d'image échoue 2 fois → le post reste `draft` avec placeholder et badge « image à ajouter » (un post peut aussi être publié sans image, mais l'objectif est toujours avec image).

## UI

- `/posts` : vue queue par défaut (groupée par statut : Dus → Brouillons → Planifiés → Publiés ce mois) + toggle vue calendrier mensuel (les posts planifiés/publiés sur une grille).
- Carte de post : miniature image, 2 premières lignes du texte, client, date planifiée, statut.
- Éditeur de post : split view — formulaire à gauche, **préviz fidèle d'un post Google** à droite (carte style Google avec image, nom du client, texte, bouton CTA) mise à jour en temps réel.
- Action batch « Générer tous les posts dus » avec barre de progression (génère séquentiellement, affiche chaque post qui tombe en draft).
