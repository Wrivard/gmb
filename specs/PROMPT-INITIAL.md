# PROMPT INITIAL — à donner à Claude Code (CLI)

> Copier-coller le bloc ci-dessous tel quel dans Claude Code, avec tous les fichiers .md de ce dossier placés dans `./specs/` à la racine du repo vide.

---

Tu construis **Küa Locale**, une application web interne de gestion des Google Business Profiles pour l'agence Küa. La spécification complète se trouve dans le dossier `./specs/` — c'est ta source de vérité absolue.

**Démarrage :**
1. Lis `specs/README.md` en premier, puis TOUS les autres fichiers de `specs/` dans l'ordre (00 à 10). Ne commence rien avant d'avoir tout lu.
2. Crée `PROGRESS.md` à la racine et suis rigoureusement le protocole de loop décrit dans `specs/10-PLAN-DE-BUILD.md`.
3. Commence la Phase 0 immédiatement.

**Mode de travail (loop autonome) :**
- Tu travailles en boucle continue, le plus longtemps possible, sans me demander quoi que ce soit. Enchaîne les phases une après l'autre.
- À chaque ambiguïté : prends la décision la plus raisonnable alignée avec les specs, note-la dans `PROGRESS.md` sous « Décisions », et continue. Ne t'arrête JAMAIS pour poser une question.
- Avant chaque commit : `pnpm build` + `pnpm lint` + `pnpm test` doivent passer. Jamais de commit cassé. Commits atomiques en français.
- Tout ce qui touche l'API Google passe par l'interface `GbpClient` avec `GBP_MODE=mock` (specs 04). Aucune vraie clé Google n'est requise pour avancer — l'accès à l'API est en attente d'approbation par Google. Tout doit être 100 % fonctionnel et démontrable en mode mock.
- Si une clé externe manque (Anthropic, Gemini) : implémente quand même le module au complet avec un fallback stub clairement identifié, note-le dans la section « 🧍 Requis de William » de `PROGRESS.md`, et continue.
- À la reprise d'une session : relis `PROGRESS.md` en premier, puis reprends exactement où tu étais.

**Priorités de qualité (dans l'ordre) :**
1. Le frontend : dark premium, réactif, optimistic updates, micro-interactions — voir `specs/09`. C'est le critère #1. Une feature au frontend médiocre n'est pas terminée.
2. La robustesse : gestion d'erreurs, retry/backoff, tokens chiffrés, RLS.
3. La fidélité aux specs : chaque écran et chaque workflow décrit doit exister tel que spécifié.

**Interdits :**
- Changer le stack (Next.js 15 / Supabase / Vercel / shadcn / Anthropic / Gemini).
- Publier quoi que ce soit vers de vraies APIs Google.
- T'arrêter pour demander une clarification qu'une hypothèse raisonnable peut régler.

À la fin de chaque phase, écris dans `PROGRESS.md` un bilan de 5 lignes max, puis enchaîne directement sur la phase suivante. Commence maintenant par lire les specs, puis Phase 0. Go.
