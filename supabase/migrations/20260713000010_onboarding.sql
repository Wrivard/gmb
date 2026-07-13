-- Onboarding d'un nouveau projet : création manuelle avant connexion
-- Google + checklist d'optimisation de la fiche GBP.

-- Un projet peut exister avant que sa fiche soit liée (création manuelle
-- à la signature du mandat) — la découverte Google liera la fiche ensuite.
alter table public.clients alter column gbp_account_id drop not null;
alter table public.clients alter column gbp_location_id drop not null;

-- État de la checklist d'optimisation, par item :
-- { "items": { "<étape.item>": { "done": true, "by": "email", "at": "iso" } },
--   "completed_at": "iso" }
-- Les définitions d'étapes vivent dans lib/onboarding/steps.ts (le code
-- est la source de vérité du contenu; la base ne stocke que l'état).
alter table public.clients add column onboarding jsonb not null default '{}'::jsonb;
