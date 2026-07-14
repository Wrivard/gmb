-- Geogrid rank tracking (palier 2, étape 2) : position du client dans
-- Google Maps sur une grille 7×7 de points géographiques, par mot-clé,
-- une fois par mois. clients.geogrid = config (mots-clés, identité
-- Maps résolue, coordonnées géocodées).

alter table public.clients
  add column geogrid jsonb not null default '{}'::jsonb;

create table public.geogrid_scans (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  keyword text not null,
  -- 'dataforseo' ou 'mock' (avant les accès API) — les mocks se purgent
  -- d'un delete where provider = 'mock'.
  provider text not null,
  grid_size int not null,
  spacing_km double precision not null,
  center_lat double precision not null,
  center_lng double precision not null,
  -- 49 points ordonnés ligne par ligne : [{lat, lng, rank}] — rank null
  -- = pas trouvé dans le top (depth) à ce point.
  ranks jsonb not null,
  avg_rank double precision,
  best_rank int,
  found_count int not null default 0,
  cost_usd double precision not null default 0,
  scanned_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index geogrid_scans_client_kw_idx
  on public.geogrid_scans (client_id, keyword, scanned_at desc);

alter table public.geogrid_scans enable row level security;

create policy geogrid_scans_member_all on public.geogrid_scans
  for all using (
    client_id in (
      select id from public.clients
      where agency_id in (select public.user_agency_ids())
    )
  );
