-- Photos de la fiche GBP (wizard d'onboarding) : bucket public — comme
-- post-images, l'API média de Google exigera une sourceUrl publique.
insert into storage.buckets (id, name, public)
values ('gbp-photos', 'gbp-photos', true)
on conflict (id) do nothing;

create policy gbp_photos_member_read on storage.objects
  for select to authenticated
  using (bucket_id = 'gbp-photos');

create policy gbp_photos_member_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'gbp-photos');

create policy gbp_photos_member_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'gbp-photos');
