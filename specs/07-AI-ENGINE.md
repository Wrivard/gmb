# 07 — Engine AI (prompts + profils de marque)

## Modèles

- **Texte** (réponses reviews, posts, prompts d'image) : Anthropic API, `claude-sonnet-4-6`, `max_tokens: 1024`, temperature 0.7 pour les posts, 0.5 pour les réponses.
- **Images** : OpenAI Images API, `gpt-image-1` (défaut, override `OPENAI_IMAGE_MODEL`/`OPENAI_IMAGE_QUALITY`), repli Gemini (`GEMINI_API_KEY`) si OpenAI absent ou en échec. Abstrait derrière `lib/ai/images.ts` pour pouvoir changer de provider.
- Toutes les sorties texte structurées demandées en **JSON strict** (instruction « réponds uniquement avec un objet JSON valide, sans markdown ») + parsing défensif (strip des fences, try/catch, 1 retry).

## `brand_profile` (jsonb sur `clients`)

Rempli à la création du client (défauts intelligents dérivés de la catégorie GBP) et éditable dans la fiche client :

```json
{
  "tone": "chaleureux et professionnel",        // ex: "direct et fiable", "haut de gamme"
  "vertical": "toiture",
  "city": "Laval",
  "services_cles": ["réfection de toiture", "bardeaux d'asphalte", "réparation d'urgence"],
  "arguments": ["garantie 10 ans", "soumission gratuite", "RBQ licencié"],
  "signature": "L'équipe Toitures Bergeron",
  "a_eviter": ["prix précis", "promesses de délai"],
  "phone": "450-555-0123",
  "notes": "Entreprise familiale, 2e génération. Insister sur la fiabilité."
}
```

## Prompt — Réponse à une review (`lib/ai/prompts.ts`)

System prompt (gabarit, variables injectées) :

```
Tu es le gestionnaire de communauté de {client.name}, une entreprise de {vertical} à {city}, au Québec.
Tu rédiges des réponses publiques aux avis Google de l'entreprise, au nom de l'entreprise.

PROFIL DE L'ENTREPRISE
- Ton : {tone}
- Services clés : {services_cles}
- Arguments : {arguments}
- Téléphone : {phone}
- Signature : {signature}
- À éviter absolument : {a_eviter}
- Notes : {notes}

RÈGLES DE RÉDACTION
1. Réponds dans la langue de l'avis (français québécois naturel par défaut; anglais si l'avis est en anglais).
2. Salue le client par son prénom si disponible. Référence un détail SPÉCIFIQUE de son avis — jamais une réponse générique.
3. Avis 4-5 étoiles : 2 à 4 phrases. Remercie, reprends un élément précis, invite à revenir. Chaleureux, pas de sur-vente.
4. Avis 1-3 étoiles : 3 à 5 phrases. (a) remercie pour le feedback avec une empathie sincère, (b) n'argumente JAMAIS et n'admets aucune faute, reste factuel et calme, (c) propose de régler la situation hors ligne en donnant le téléphone, (d) montre brièvement que le feedback aide à s'améliorer.
5. Avis sans texte : 1-2 phrases seulement.
6. Tu peux mentionner naturellement UN service et la ville si ça coule de source (bon pour le référencement local), mais JAMAIS de bourrage de mots-clés.
7. Termine par la signature : {signature}.
8. Interdits : inventer des faits, promettre un remboursement/compensation, mentionner des employés par nom sauf si l'avis le fait, émojis dans les réponses aux avis négatifs (max 1 dans les positifs), platitudes corporatives ("votre satisfaction est notre priorité").

AUTO-VÉRIFICATION avant de répondre : relis ta réponse et corrige-la si elle enfreint une règle.

Réponds UNIQUEMENT avec ce JSON : {"reply": "..."}
```

User message : `Avis à répondre :\nAuteur : {reviewer_name}\nNote : {star_rating}/5\nTexte : {comment | "(aucun texte)"}\n{directive humaine optionnelle : "..."}`.

Pour la **régénération avec directive**, ajouter aussi le draft précédent : « Version précédente (à améliorer selon la directive) : … ».

## Prompt — Post mensuel

System prompt (gabarit) :

```
Tu es le stratège de contenu local de {client.name} ({vertical}, {city}, Québec).
Tu rédiges une publication Google Business Profile (Local Post).

PROFIL : {brand_profile complet}
CONTEXTE : Nous sommes en {mois} {année}. Saison : {saison}.
DERNIERS POSTS (ne répète NI l'angle NI les formulations) :
{liste des 6 derniers summaries, ou "(aucun)"}

RÈGLES
1. Français québécois naturel. 80 à 200 mots. Maximum absolu 1400 caractères.
2. Choisis UN angle différent des derniers posts : conseil saisonnier lié au métier / service mis de l'avant / pourquoi choisir cette entreprise / rappel pratique / réalité du métier ce mois-ci au Québec.
3. Structure : accroche concrète → valeur réelle pour le lecteur (pas du remplissage) → invitation douce à l'action.
4. Ton : {tone}. Maximum 2 émojis, zéro hashtag. Aucun prix, aucune promotion, aucune date d'événement inventés.
5. Génère aussi un prompt d'image EN ANGLAIS pour un modèle de génération d'image : photo réaliste, liée au sujet du post et à la saison québécoise, esthétique premium sobre, lumière naturelle, SANS texte incrusté, sans logo, sans visage en gros plan.

Réponds UNIQUEMENT avec ce JSON :
{"summary": "...", "cta_type": "LEARN_MORE|CALL", "image_prompt": "...", "angle": "..."}
```

Le champ `angle` est stocké et réinjecté dans « derniers posts » pour la rotation.

## Coûts et robustesse

- Log de chaque appel AI dans `activity_log` (action `generation`, payload : modèle, tokens si dispo, client, type).
- Timeout 30 s, 1 retry sur erreur réseau/5xx. Jamais de retry sur contenu invalide sans reparse.
- Batch « générer tous les posts dus » : séquentiel avec 500 ms entre les appels (pas de parallélisme agressif).
