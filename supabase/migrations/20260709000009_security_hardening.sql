-- Passe sécurité — remédiation des advisors Supabase (2026-07-09).

-- 1. Lint 0011 : search_path mutable sur la fonction trigger générique.
-- Son corps ne référence aucune table (new.updated_at) : un search_path
-- vide est sans effet fonctionnel et ferme le vecteur d'injection.
alter function public.set_updated_at() set search_path = '';

-- 2. Lints 0028/0029 : fonctions SECURITY DEFINER exposées via
-- /rest/v1/rpc.
-- user_agency_ids : appelée par TOUTES les policies RLS, donc
-- `authenticated` doit garder EXECUTE (l'évaluation d'une policy se fait
-- avec les droits du requérant). On ferme anon/public — pour un anonyme
-- elle retournait un set vide, mais rien ne doit être appelable sans
-- session.
revoke execute on function public.user_agency_ids() from public, anon;
grant execute on function public.user_agency_ids() to authenticated;

-- link_member_on_signup : fonction de trigger (on_auth_user_created sur
-- auth.users) — jamais destinée à être appelée par l'API. Le trigger
-- continue de fonctionner : le privilège EXECUTE n'est pas revérifié au
-- déclenchement (l'insert vient de supabase_auth_admin).
revoke execute on function public.link_member_on_signup()
  from public, anon, authenticated;

-- 3. Lint 0025 : bucket public listable. L'affichage des images passe
-- par /object/public/ (aucune policy requise sur un bucket public) ;
-- seul le list() côté serveur (versions d'images, lib/posts/generate.ts)
-- a besoin de SELECT — on le réserve aux membres connectés.
drop policy post_images_public_read on storage.objects;
create policy post_images_member_read on storage.objects
  for select to authenticated
  using (bucket_id = 'post-images');

-- 4. Correctif attrapé en passant : aucune policy DELETE n'existait sur
-- storage.objects — le ménage des versions d'images (remove() dans
-- processAndUploadImage) était silencieusement bloqué par la RLS.
create policy post_images_member_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'post-images');
