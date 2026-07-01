# 09 — Frontend & Design System (critère de qualité #1)

## Direction

**Dark premium Küa.** Sobre, dense en information mais aéré, zéro look « template Bootstrap ». Référence d'ambiance : Linear, Vercel dashboard, Resend. L'app doit donner l'impression d'un outil interne haut de gamme.

## Tokens

```css
--bg:            #0B0D10;   /* fond app */
--bg-elevated:   #12151A;   /* cartes, panneaux */
--bg-hover:      #1A1E25;
--border:        #232830;   /* bordures subtiles 1px */
--text:          #EDEFF2;
--text-muted:    #8B93A1;
--accent:        #E8C468;   /* doré Küa — actions primaires, focus */
--accent-fg:     #0B0D10;   /* texte sur accent */
--success:       #4ADE80;
--warning:       #FBBF24;
--danger:        #F87171;
--info:          #60A5FA;
--radius:        10px;
```

- Typo : **Inter** (UI) via `next/font`, tracking léger négatif sur les titres. Tabular nums pour les compteurs.
- Ombres quasi absentes; la hiérarchie vient des surfaces (`bg` → `bg-elevated`) et des bordures 1px.
- Accent doré utilisé avec parcimonie : bouton primaire, éléments actifs, étoiles des reviews. Tout le reste est neutre.
- Configurer shadcn/ui en dark par défaut avec ces tokens (pas de light mode au MVP).

## Layout

- Sidebar fixe 240px : logo Küa, nav (Dashboard, Reviews, Posts, Clients, Réglages) avec compteurs en pastilles (reviews en attente, posts dus), user menu en bas.
- Topbar mince : titre de page, recherche client (`Cmd+K` → command palette shadcn), statut sync.
- Contenu max-width 1400px. Densité confortable : padding généreux dans les cartes, listes compactes dans les inbox.
- Responsive : utilisable sur tablette (sidebar → drawer). Le mobile n'est pas prioritaire mais rien ne doit être cassé.

## Micro-interactions (obligatoires — c'est ça le « feel » premium)

- **Optimistic updates** sur toutes les mutations (publier, approuver, ignorer) — l'UI répond en < 50 ms, rollback + toast en cas d'échec.
- Transitions discrètes : cartes kanban qui se déplacent avec une animation layout (Framer Motion `layout`), fade des items d'inbox traités.
- Skeletons partout au chargement (jamais de spinner plein écran).
- Toasts (sonner) : confirmation avec action undo quand applicable.
- États vides soignés avec illustration légère + CTA (« Aucune review en attente 🎉 »).
- Boutons de génération AI : état loading avec micro-texte rotatif (« Analyse de l'avis… », « Rédaction… »).
- Raccourcis clavier documentés dans un modal `?`.

## Composants clés

- `<StarRating value={1-5}>` — étoiles dorées, tailles sm/md.
- `<ReviewCard>` — item d'inbox avec panneau de réponse expandable inline.
- `<PostPreview>` — réplique fidèle d'une carte Local Post Google (image 4:3, nom+avatar de la fiche, texte tronqué « Plus », bouton CTA) pour la préviz temps réel.
- `<ClientCard>` — carte kanban.
- `<DueBadge>`, `<SyncStatus>`, `<ModeBadge mode="mock">`.

## Qualité

- Lighthouse ≥ 90 perf/accessibilité sur les pages principales.
- Aucune erreur console, aucun layout shift visible.
- Textes UI : français québécois, tutoiement léger et direct (« Génère le post », « Tout est à jour »).
