-- Realtime sur reviews et posts (specs/08) : le kanban se met à jour
-- sans refresh quand le cron sync trouve du nouveau ou qu'un collègue
-- publie.

alter publication supabase_realtime add table public.reviews;
alter publication supabase_realtime add table public.posts;
