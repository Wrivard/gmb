-- Küa Locale — migration 001 : schéma complet (specs/03-DATABASE.md)

-- =============================================================
-- Trigger updated_at générique
-- =============================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =============================================================
-- agencies
-- =============================================================
create table public.agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  default_posts_per_month int not null default 2,
  default_language text not null default 'fr-CA',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger agencies_updated_at
  before update on public.agencies
  for each row execute function public.set_updated_at();

-- =============================================================
-- agency_members
-- user_id nullable : la whitelist peut précéder le premier login;
-- un trigger sur auth.users lie le compte à l'email au signup.
-- =============================================================
create table public.agency_members (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  user_id uuid unique references auth.users (id) on delete set null,
  email text not null unique,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger agency_members_updated_at
  before update on public.agency_members
  for each row execute function public.set_updated_at();

-- Lie automatiquement un nouveau compte auth à sa ligne whitelist
create or replace function public.link_member_on_signup()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.agency_members
     set user_id = new.id
   where lower(email) = lower(new.email)
     and user_id is null;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.link_member_on_signup();

-- =============================================================
-- google_connections
-- =============================================================
create table public.google_connections (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null unique references public.agencies (id) on delete cascade,
  google_email text not null,
  refresh_token_encrypted text not null,
  status text not null default 'active' check (status in ('active', 'revoked')),
  connected_at timestamptz not null default now(),
  last_refreshed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger google_connections_updated_at
  before update on public.google_connections
  for each row execute function public.set_updated_at();

-- =============================================================
-- clients (une location GBP)
-- =============================================================
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  gbp_account_id text not null,
  gbp_location_id text not null unique,
  name text not null,
  address text,
  phone text,
  website text,
  primary_category text,
  status text not null default 'active' check (status in ('active', 'paused', 'disconnected')),
  posts_per_month int not null default 2,
  auto_publish_replies boolean not null default false,
  auto_publish_posts boolean not null default false,
  language text not null default 'fr-CA',
  brand_profile jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index clients_agency_status_idx on public.clients (agency_id, status);

create trigger clients_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

-- =============================================================
-- reviews
-- =============================================================
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  gbp_review_id text not null unique,
  gbp_review_name text not null,
  reviewer_name text,
  reviewer_photo_url text,
  star_rating int not null check (star_rating between 1 and 5),
  comment text,
  review_created_at timestamptz not null,
  review_updated_at timestamptz,
  status text not null default 'needs_reply'
    check (status in ('needs_reply', 'draft_ready', 'approved', 'replied', 'ignored')),
  was_updated boolean not null default false,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index reviews_client_status_idx on public.reviews (client_id, status);
create index reviews_created_desc_idx on public.reviews (review_created_at desc);

create trigger reviews_updated_at
  before update on public.reviews
  for each row execute function public.set_updated_at();

-- =============================================================
-- review_replies
-- =============================================================
create table public.review_replies (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null unique references public.reviews (id) on delete cascade,
  draft_text text not null,
  published_text text,
  generated_by_ai boolean not null default true,
  generation_count int not null default 1,
  approved_by uuid references public.agency_members (id),
  published_at timestamptz,
  publish_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger review_replies_updated_at
  before update on public.review_replies
  for each row execute function public.set_updated_at();

-- =============================================================
-- posts
-- =============================================================
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  type text not null default 'STANDARD' check (type in ('STANDARD', 'EVENT', 'OFFER')),
  summary text not null,
  cta_type text check (cta_type in ('LEARN_MORE', 'CALL', 'BOOK', 'ORDER', 'SIGN_UP')),
  cta_url text,
  image_path text,
  image_prompt text,
  angle text,
  status text not null default 'draft'
    check (status in ('draft', 'approved', 'scheduled', 'publishing', 'published', 'failed')),
  scheduled_for timestamptz,
  published_at timestamptz,
  gbp_post_name text,
  publish_error text,
  generated_by_ai boolean not null default true,
  approved_by uuid references public.agency_members (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index posts_client_status_idx on public.posts (client_id, status);
create index posts_scheduled_idx on public.posts (scheduled_for) where status = 'scheduled';

create trigger posts_updated_at
  before update on public.posts
  for each row execute function public.set_updated_at();

-- =============================================================
-- activity_log
-- =============================================================
create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid references public.agencies (id) on delete cascade,
  client_id uuid references public.clients (id) on delete cascade,
  actor text not null,
  action text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index activity_log_agency_idx on public.activity_log (agency_id, created_at desc);
create index activity_log_client_idx on public.activity_log (client_id, created_at desc);

-- =============================================================
-- Vue kanban : client_board_state
-- Mois courant en America/Toronto (specs/06)
-- =============================================================
create or replace view public.client_board_state
with (security_invoker = true)
as
with month_bounds as (
  select
    date_trunc('month', (now() at time zone 'America/Toronto'))::timestamp as month_start
),
review_counts as (
  select
    r.client_id,
    count(*) filter (where r.status in ('needs_reply', 'draft_ready')) as unreplied_count,
    count(*) filter (where r.status = 'draft_ready') as draft_reply_count,
    min(r.star_rating) filter (where r.status in ('needs_reply', 'draft_ready')) as worst_pending_rating,
    min(r.review_created_at) filter (where r.status in ('needs_reply', 'draft_ready')) as oldest_pending_review_at
  from public.reviews r
  group by r.client_id
),
post_counts as (
  select
    p.client_id,
    count(*) filter (
      where p.status = 'published'
        and (p.published_at at time zone 'America/Toronto') >= (select month_start from month_bounds)
    ) as posts_published_this_month,
    count(*) filter (
      where p.status in ('scheduled', 'approved')
        and (p.scheduled_for at time zone 'America/Toronto') >= (select month_start from month_bounds)
    ) as posts_scheduled_this_month,
    count(*) filter (where p.status = 'draft') as draft_post_count,
    min(p.scheduled_for) filter (where p.status = 'scheduled' and p.scheduled_for > now()) as next_scheduled_post
  from public.posts p
  group by p.client_id
)
select
  c.id as client_id,
  c.agency_id,
  c.name,
  c.status,
  c.posts_per_month,
  coalesce(rc.unreplied_count, 0) as unreplied_count,
  coalesce(rc.draft_reply_count, 0) as draft_reply_count,
  rc.worst_pending_rating,
  rc.oldest_pending_review_at,
  coalesce(pc.posts_published_this_month, 0) as posts_published_this_month,
  coalesce(pc.posts_scheduled_this_month, 0) as posts_scheduled_this_month,
  coalesce(pc.draft_post_count, 0) as draft_post_count,
  greatest(
    0,
    c.posts_per_month
      - coalesce(pc.posts_published_this_month, 0)
      - coalesce(pc.posts_scheduled_this_month, 0)
  ) as posts_due,
  pc.next_scheduled_post
from public.clients c
left join review_counts rc on rc.client_id = c.id
left join post_counts pc on pc.client_id = c.id;

-- =============================================================
-- RLS
-- =============================================================
alter table public.agencies enable row level security;
alter table public.agency_members enable row level security;
alter table public.google_connections enable row level security;
alter table public.clients enable row level security;
alter table public.reviews enable row level security;
alter table public.review_replies enable row level security;
alter table public.posts enable row level security;
alter table public.activity_log enable row level security;

-- Helper : les agences du user courant
create or replace function public.user_agency_ids()
returns setof uuid
language sql
stable
security definer set search_path = public
as $$
  select agency_id from public.agency_members where user_id = auth.uid();
$$;

create policy agencies_member_all on public.agencies
  for all using (id in (select public.user_agency_ids()));

create policy agency_members_member_all on public.agency_members
  for all using (agency_id in (select public.user_agency_ids()));

create policy google_connections_member_all on public.google_connections
  for all using (agency_id in (select public.user_agency_ids()));

create policy clients_member_all on public.clients
  for all using (agency_id in (select public.user_agency_ids()));

create policy reviews_member_all on public.reviews
  for all using (
    client_id in (
      select id from public.clients
      where agency_id in (select public.user_agency_ids())
    )
  );

create policy review_replies_member_all on public.review_replies
  for all using (
    review_id in (
      select r.id from public.reviews r
      join public.clients c on c.id = r.client_id
      where c.agency_id in (select public.user_agency_ids())
    )
  );

create policy posts_member_all on public.posts
  for all using (
    client_id in (
      select id from public.clients
      where agency_id in (select public.user_agency_ids())
    )
  );

create policy activity_log_member_select on public.activity_log
  for select using (agency_id in (select public.user_agency_ids()));

-- =============================================================
-- Storage : bucket public pour les images de posts
-- (lecture publique requise pour sourceUrl côté Google)
-- =============================================================
insert into storage.buckets (id, name, public)
values ('post-images', 'post-images', true)
on conflict (id) do nothing;

create policy post_images_public_read on storage.objects
  for select using (bucket_id = 'post-images');
