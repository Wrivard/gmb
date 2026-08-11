-- Gardien du lien membre ↔ compte, et rôle admin enforcé en base.
--
-- Contexte : `agency_members.user_id` porte TOUTE la RLS du schéma (via
-- user_agency_ids()), mais rien ne le maintenait :
--   * le trigger on_auth_user_created ne remplit le lien qu'au signup,
--     donc jamais pour une ligne whitelist ajoutée APRÈS le premier
--     login de la personne ;
--   * addMemberAction insère sans user_id ;
--   * la RLS d'agency_members s'appuie sur user_agency_ids(), qui lit
--     agency_members : une ligne user_id NULL est donc invisible à son
--     propre propriétaire, et le repli par courriel de lib/auth.ts ne
--     pouvait jamais matcher (circularité).
-- Symptôme : « Accès non autorisé » alors que la ligne existe
-- (cas gberther@kua.quebec, 2026-08-11).

-- ── 1. Le lien se pose aussi dans l'autre sens ──────────────────────
-- Le trigger existant va auth.users → agency_members (au signup).
-- Celui-ci va agency_members → auth.users (à l'ajout d'un membre).
create or replace function public.link_member_to_auth_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if new.user_id is null then
    select u.id into new.user_id
      from auth.users u
     where lower(u.email) = lower(new.email)
     limit 1;
  end if;
  return new;
end;
$$;

drop trigger if exists agency_members_link_user on public.agency_members;
create trigger agency_members_link_user
  before insert or update of email, user_id on public.agency_members
  for each row execute function public.link_member_to_auth_user();

-- ── 2. Rattrapage des lignes déjà orphelines ────────────────────────
update public.agency_members m
   set user_id = u.id
  from auth.users u
 where m.user_id is null
   and lower(m.email) = lower(u.email);

-- ── 3. Résolution de l'appartenance hors de la circularité ──────────
-- SECURITY DEFINER : ne dépend pas de la RLS qu'elle alimente. Scopée
-- strictement à auth.uid(). Répare le lien par courriel si les deux
-- triggers ont été contournés (import SQL manuel, casse différente).
create or replace function public.current_member()
returns setof public.agency_members
language plpgsql
security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  mail text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if uid is null then
    return;
  end if;

  return query
    select * from public.agency_members where user_id = uid limit 1;
  if found then
    return;
  end if;

  if mail <> '' then
    return query
      with repaired as (
        update public.agency_members
           set user_id = uid
         where lower(email) = mail
           and user_id is null
        returning *
      )
      select * from repaired;
  end if;
end;
$$;

grant execute on function public.current_member() to authenticated;

-- ── 4. Le rôle admin cesse d'être une coutume applicative ───────────
-- SECURITY DEFINER pour éviter la récursion : une policy sur
-- agency_members ne peut pas interroger agency_members directement.
create or replace function public.user_is_owner_of(target_agency uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
      from public.agency_members
     where user_id = auth.uid()
       and agency_id = target_agency
       and role = 'owner'
  );
$$;

grant execute on function public.user_is_owner_of(uuid) to authenticated;

-- Lecture : tout membre de l'agence. Écriture : admins seulement.
-- (l'ancienne policy unique était FOR ALL sans distinction de rôle —
-- un compte 'member' pouvait s'auto-promouvoir via PostgREST.)
drop policy if exists agency_members_member_all on public.agency_members;

create policy agency_members_select on public.agency_members
  for select using (agency_id in (select public.user_agency_ids()));

create policy agency_members_owner_write on public.agency_members
  for all
  using (
    agency_id in (select public.user_agency_ids())
    and public.user_is_owner_of(agency_id)
  )
  with check (
    agency_id in (select public.user_agency_ids())
    and public.user_is_owner_of(agency_id)
  );
