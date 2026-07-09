-- Chantier « onboarding » : statut archived pour l'offboarding. Un
-- client parti restait `disconnected` pour toujours — archived le sort
-- des listes et des syncs sans rien supprimer (historique conservé).

alter table public.clients drop constraint clients_status_check;
alter table public.clients add constraint clients_status_check
  check (status in ('active', 'paused', 'disconnected', 'archived'));
