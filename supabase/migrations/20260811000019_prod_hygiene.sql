-- Hygiène avant les premiers vrais clients.
--
-- 1. La policy d'écriture admin posée en ...017 était `FOR ALL`, donc
--    elle couvrait aussi le SELECT — deux policies permissives évaluées
--    à chaque lecture d'agency_members pour rien. On la découpe sur les
--    trois actions d'écriture ; la lecture reste à agency_members_select.
-- 2. Quatre clés étrangères sans index couvrant : sans conséquence sur 8
--    lignes de démo, mais ces tables sont celles qui vont grossir.

drop policy if exists agency_members_owner_write on public.agency_members;

create policy agency_members_owner_insert on public.agency_members
  for insert
  with check (
    agency_id in (select public.user_agency_ids())
    and public.user_is_owner_of(agency_id)
  );

create policy agency_members_owner_update on public.agency_members
  for update
  using (
    agency_id in (select public.user_agency_ids())
    and public.user_is_owner_of(agency_id)
  )
  with check (
    agency_id in (select public.user_agency_ids())
    and public.user_is_owner_of(agency_id)
  );

create policy agency_members_owner_delete on public.agency_members
  for delete
  using (
    agency_id in (select public.user_agency_ids())
    and public.user_is_owner_of(agency_id)
  );

create index if not exists agency_members_agency_id_idx
  on public.agency_members (agency_id);
create index if not exists clients_assignee_member_id_idx
  on public.clients (assignee_member_id);
create index if not exists posts_approved_by_idx
  on public.posts (approved_by);
create index if not exists review_replies_approved_by_idx
  on public.review_replies (approved_by);
