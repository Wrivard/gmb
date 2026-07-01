# 08 — Dashboard Kanban

## Concept

La page d'accueil (`/`). En un coup d'œil : l'état de TOUS les clients. C'est un kanban **d'états calculés**, pas de drag-and-drop — les cartes bougent automatiquement quand le travail est fait. (Le drag manuel n'a pas de sens : on ne « déplace » pas un client, on répond à ses reviews.)

## Colonnes (dans cet ordre)

| Colonne | Condition (via la vue `client_board_state`) | Couleur accent |
|---|---|---|
| **🔴 Reviews à répondre** | `unreplied_count > 0` | rouge/ambre |
| **📝 Posts dus** | `posts_due > 0` (et pas de reviews en attente) | ambre |
| **⏳ En attente d'approbation** | drafts de réponses ou posts `draft` à réviser, rien d'autre en retard | bleu |
| **✅ À jour** | tout le reste | vert discret |

Un client apparaît dans UNE seule colonne — la plus urgente (priorité = ordre ci-dessus). Si un client a des reviews non répondues ET des posts dus, il est dans « Reviews à répondre » avec les deux badges visibles sur sa carte.

## Carte client

- Nom du client + catégorie/ville en sous-titre.
- Badges compteurs : `3 reviews` (avec la pire note en attente : « dont une 1★ » en rouge), `1 post dû`, `2 drafts`.
- Note moyenne GBP + nombre total de reviews (petits, en pied de carte).
- Indicateur de retard : review > 72 h sans réponse ou post en retard (> le 20 du mois) → liseré rouge.
- Clic sur la carte → `/clients/[id]`. Clic sur un badge → va directement à l'onglet concerné, filtré.
- Actions rapides au hover : « Répondre aux reviews » / « Générer le post ».

## Header du dashboard

- Compteurs globaux : X reviews en attente · Y posts dus ce mois · Z drafts à approuver.
- Bouton primaire contextuel : « Traiter les reviews (X) » si X > 0, sinon « Générer les posts dus (Y) ».
- Statut de la connexion Google (pastille verte « Synchronisé il y a 12 min » / rouge « Reconnexion requise ») + statut `GBP_MODE=mock` affiché clairement en dev (badge « MODE DÉMO »).

## Détail client (`/clients/[id]`)

Onglets :
1. **Aperçu** — mêmes stats que la carte + activité récente (activity_log filtré).
2. **Reviews** — inbox filtrée sur ce client, historique complet.
3. **Posts** — posts du client (queue + historique), bouton générer.
4. **Réglages** — cadence posts/mois, langue, auto-publish (2 toggles avec avertissement), `brand_profile` (formulaire complet), statut actif/pause.

## Temps réel / réactivité

- Supabase Realtime sur `reviews` et `posts` : le kanban se met à jour sans refresh quand le cron sync trouve du nouveau ou qu'un collègue publie.
- Toutes les actions (publier, approuver, ignorer) : optimistic update + toast de confirmation (avec undo quand possible, ex : ignorer).
