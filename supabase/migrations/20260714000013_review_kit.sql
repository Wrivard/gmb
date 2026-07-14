-- Kit d'avis (palier 1) : page publique « Demander un avis » par projet.
-- Le token non devinable est la seule clé d'accès — pas de session.
alter table public.clients
  add column review_kit_token uuid not null default gen_random_uuid(),
  add column review_kit jsonb not null default '{}'::jsonb;

create unique index clients_review_kit_token_idx
  on public.clients (review_kit_token);

-- Lecture publique par token, bornée : la fonction renvoie UNIQUEMENT
-- les champs du kit (jamais la ligne clients), en SECURITY DEFINER pour
-- passer la RLS sans policy anon sur la table.
create or replace function public.review_kit(token uuid)
returns table (client_name text, review_link text, message text)
language sql
security definer
set search_path = ''
stable
as $$
  select c.name, c.review_kit->>'review_link', c.review_kit->>'message'
  from public.clients c
  where c.review_kit_token = token
    and c.status <> 'archived';
$$;

revoke all on function public.review_kit(uuid) from public;
grant execute on function public.review_kit(uuid) to anon, authenticated;
