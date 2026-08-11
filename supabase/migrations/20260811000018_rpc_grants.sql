-- Resserrage des droits d'exécution sur les fonctions SECURITY DEFINER.
--
-- Le linter Supabase signalait 4 fonctions appelables via /rest/v1/rpc/
-- par le rôle `anon`. Deux ont été introduites par la migration
-- précédente (20260811000017) : PostgREST expose par défaut tout ce qui
-- vit dans le schéma `public`.
--
-- Aucune n'était réellement exploitable (auth.uid() est NULL pour anon,
-- et une fonction trigger ne peut pas être appelée hors trigger), mais
-- une fonction SECURITY DEFINER exposée publiquement n'a pas à l'être :
-- le prochain élargissement de son corps deviendrait une faille.

-- Fonction trigger : jamais appelée directement, par personne.
revoke all on function public.link_member_to_auth_user() from public, anon, authenticated;

-- Résolution d'appartenance : réservée aux sessions authentifiées.
revoke all on function public.current_member() from public, anon;
grant execute on function public.current_member() to authenticated;

-- Prédicat de rôle (utilisé par les policies) : idem.
revoke all on function public.user_is_owner_of(uuid) from public, anon;
grant execute on function public.user_is_owner_of(uuid) to authenticated;

-- public.review_kit(uuid) reste volontairement exécutable par anon :
-- c'est le socle de la page publique /avis/<token> (migration ...013).
