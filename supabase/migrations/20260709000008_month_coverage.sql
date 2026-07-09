-- Chantier « rapport mensuel » : couverture de cadence persistée par
-- mois. Sans elle, deux problèmes : (1) un déficit s'efface au 1er du
-- mois (aucune trace qu'un client payé 2 posts n'en a reçu qu'un), et
-- (2) la couverture historique était calculée avec la cadence ACTUELLE
-- (changer 1→2 posts/mois réécrivait le passé en « sous-couvert »).
-- posts_target est figé au premier passage du cron dans le mois.

create table public.client_month_coverage (
  client_id uuid not null references public.clients(id) on delete cascade,
  month date not null, -- 1er du mois (calendrier Toronto)
  posts_target int not null,
  posts_published int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (client_id, month)
);

alter table public.client_month_coverage enable row level security;

create policy client_month_coverage_member_all on public.client_month_coverage
  for all using (
    client_id in (
      select id from public.clients
      where agency_id in (select public.user_agency_ids())
    )
  );
