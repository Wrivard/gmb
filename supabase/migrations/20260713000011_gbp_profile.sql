-- Données de la fiche GBP éditées DANS l'app (wizard d'onboarding v2) :
-- catégories, NAP, heures, description, services, Q&A — avec état de
-- push par section (sync.<section> = { pushed_at, by, dirty }).
-- L'app devient la source de saisie; le push passe par GbpClient
-- (mock aujourd'hui, réel à l'approbation de l'API).
alter table public.clients add column gbp_profile jsonb not null default '{}'::jsonb;
