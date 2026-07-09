-- Chantier « échecs visibles » : un post en échec de publication était
-- invisible sur le tableau (la vue ne comptait pas status='failed') et
-- posts_due restait gonflé — le kanban invitait à générer un DOUBLON au
-- lieu de corriger. On expose failed_post_count et on fait compter un
-- échec du mois comme un slot occupé de la cadence.
-- NB : create or replace view exige de ne pas toucher aux colonnes
-- existantes (ordre/noms) — failed_post_count s'ajoute en fin.

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
    min(p.scheduled_for) filter (where p.status = 'scheduled' and p.scheduled_for > now()) as next_scheduled_post,
    count(*) filter (where p.status = 'failed') as failed_post_count,
    count(*) filter (
      where p.status = 'failed'
        and (p.scheduled_for at time zone 'America/Toronto') >= (select month_start from month_bounds)
    ) as failed_this_month
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
      - coalesce(pc.failed_this_month, 0)
  ) as posts_due,
  pc.next_scheduled_post,
  coalesce(pc.failed_post_count, 0) as failed_post_count
from public.clients c
left join review_counts rc on rc.client_id = c.id
left join post_counts pc on pc.client_id = c.id;
