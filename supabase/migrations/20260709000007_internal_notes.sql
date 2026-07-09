-- Chantier « gouvernance » : notes internes humaines. brand_profile.notes
-- part dans le prompt AI — une consigne opérationnelle (« appeler le
-- client avant de répondre aux négatives ») n'avait nulle part où vivre
-- sans contaminer les drafts. internal_notes n'est JAMAIS envoyé à l'AI.

alter table public.clients add column internal_notes text;
