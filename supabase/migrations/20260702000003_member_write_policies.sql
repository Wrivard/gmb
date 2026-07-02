-- Policies manquantes pour faire tourner l'app avec le client de
-- session (sans service role) : log d'activité + upload d'images.

create policy activity_log_member_insert on public.activity_log
  for insert to authenticated
  with check (agency_id in (select public.user_agency_ids()));

create policy post_images_member_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'post-images');

create policy post_images_member_update on storage.objects
  for update to authenticated
  using (bucket_id = 'post-images');
