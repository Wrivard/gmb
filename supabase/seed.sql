-- Küa Locale — seed mock (specs/03) : 1 agence, 2 membres whitelist,
-- 8 clients québécois, ~40 reviews variées, posts historiques.
-- Les IDs fixes sont partagés avec les fixtures de lib/gbp/fixtures/.

-- ============================================================
-- Agence + whitelist
-- ============================================================
insert into public.agencies (id, name, default_posts_per_month, default_language)
values ('a0000000-0000-4000-8000-000000000001', 'Küa', 2, 'fr-CA');

insert into public.agency_members (id, agency_id, email, role) values
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'wrivard@kua.quebec', 'owner'),
  ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'equipe@kua.quebec', 'member')
on conflict do nothing;

-- ============================================================
-- Clients (8 locations GBP mock)
-- ============================================================
insert into public.clients
  (id, agency_id, gbp_account_id, gbp_location_id, name, address, phone, website, primary_category, posts_per_month, language, brand_profile)
values
  ('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   'accounts/108231694201573849275', 'locations/2801539874651203748',
   'Toitures Bergeron', '1245 boul. des Laurentides, Laval, QC H7M 2Y2', '450-555-0123',
   'https://toituresbergeron.ca', 'Couvreur', 2, 'fr-CA',
   '{"tone":"chaleureux et professionnel","vertical":"toiture","city":"Laval","services_cles":["réfection de toiture","bardeaux d''asphalte","réparation d''urgence"],"arguments":["garantie 10 ans","soumission gratuite","RBQ licencié"],"signature":"L''équipe Toitures Bergeron","a_eviter":["prix précis","promesses de délai"],"phone":"450-555-0123","notes":"Entreprise familiale, 2e génération. Insister sur la fiabilité."}'),

  ('c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001',
   'accounts/108231694201573849275', 'locations/5519274830165928374',
   'Garage Pro-Tech Mécanique', '3820 ch. de Chambly, Longueuil, QC J4L 1N6', '450-555-0456',
   'https://garageprotech.ca', 'Atelier de réparation automobile', 2, 'fr-CA',
   '{"tone":"direct et fiable","vertical":"mécanique automobile","city":"Longueuil","services_cles":["entretien général","freins et suspension","pneus et alignement"],"arguments":["estimation claire avant travaux","techniciens certifiés","navette de courtoisie"],"signature":"L''équipe du Garage Pro-Tech","a_eviter":["prix précis","jargon technique lourd"],"phone":"450-555-0456","notes":"Clientèle fidèle de quartier. Transparence = argument #1."}'),

  ('c0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001',
   'accounts/108231694201573849275', 'locations/8837465102947586921',
   'Paysagement Verdure', '710 rue Saint-Louis, Terrebonne, QC J6W 1J1', '450-555-0789',
   'https://paysagementverdure.ca', 'Paysagiste', 2, 'fr-CA',
   '{"tone":"inspirant et soigné","vertical":"aménagement paysager","city":"Terrebonne","services_cles":["aménagement paysager","pavé uni","entretien de terrain"],"arguments":["designs personnalisés","équipe ponctuelle","photos de réalisations"],"signature":"L''équipe Paysagement Verdure","a_eviter":["prix précis"],"phone":"450-555-0789","notes":"Très visuel — les réalisations parlent."}'),

  ('c0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001',
   'accounts/108231694201573849275', 'locations/1120394857610293847',
   'Restaurant La Bella Vita', '2145 rue Beaubien Est, Montréal, QC H2G 1M5', '514-555-0234',
   'https://labellavita.ca', 'Restaurant italien', 3, 'fr-CA',
   '{"tone":"convivial et passionné","vertical":"restauration italienne","city":"Montréal","services_cles":["pâtes fraîches maison","pizza au four à bois","menu du midi"],"arguments":["ingrédients importés d''Italie","ambiance familiale","réservation en ligne"],"signature":"La famiglia La Bella Vita","a_eviter":["promotions inventées","prix"],"phone":"514-555-0234","notes":"Tenu par la famille Rossi depuis 1998. Toujours chaleureux, un peu d''italien dans les réponses est bienvenu (Grazie!)."}'),

  ('c0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001',
   'accounts/108231694201573849275', 'locations/6647382910573829105',
   'Plomberie Riviera', '88 boul. Iberville, Repentigny, QC J6A 2A9', '450-555-0912',
   'https://plomberieriviera.ca', 'Plombier', 2, 'fr-CA',
   '{"tone":"rassurant et efficace","vertical":"plomberie","city":"Repentigny","services_cles":["urgences 24/7","chauffe-eau","débouchage de drains"],"arguments":["disponible 24/7","travail garanti","camions équipés"],"signature":"L''équipe Plomberie Riviera","a_eviter":["prix précis","délais garantis"],"phone":"450-555-0912","notes":"Les urgences sont le nerf de la guerre — répondre vite."}'),

  ('c0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000001',
   'accounts/108231694201573849275', 'locations/3958271046382910576',
   'Électricité Dumont', '5210 boul. Taschereau, Brossard, QC J4Z 1A7', '450-555-0345',
   'https://electricitedumont.ca', 'Électricien', 1, 'fr-CA',
   '{"tone":"professionnel et précis","vertical":"électricité résidentielle","city":"Brossard","services_cles":["mise aux normes","panneaux électriques","bornes de recharge"],"arguments":["maîtres électriciens CMEQ","soumission gratuite","travail propre"],"signature":"Électricité Dumont","a_eviter":["prix précis","conseils DIY dangereux"],"phone":"450-555-0345","notes":"Croissance sur les bornes de recharge VÉ."}'),

  ('c0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000001',
   'accounts/108231694201573849275', 'locations/7261849305718293645',
   'Clinique Dentaire Sourire Plus', '450 rue Blainville Ouest, Sainte-Thérèse, QC J7E 1M9', '450-555-0678',
   'https://sourireplus.ca', 'Dentiste', 1, 'fr-CA',
   '{"tone":"doux et rassurant","vertical":"soins dentaires","city":"Sainte-Thérèse","services_cles":["examen et nettoyage","dentisterie familiale","urgences dentaires"],"arguments":["nouveaux patients bienvenus","approche sans stress","équipe attentionnée"],"signature":"L''équipe de la Clinique Sourire Plus","a_eviter":["conseils médicaux précis","prix","toute info personnelle de patient"],"phone":"450-555-0678","notes":"Confidentialité stricte : jamais confirmer qu''une personne est patiente."}'),

  ('c0000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-000000000001',
   'accounts/108231694201573849275', 'locations/4830192756483920175',
   'Excavation Lachance', '1590 rang Saint-Vincent, Mirabel, QC J7N 2W5', '450-555-0567',
   null, 'Entrepreneur en excavation', 1, 'fr-CA',
   '{"tone":"franc et robuste","vertical":"excavation et déneigement","city":"Mirabel","services_cles":["excavation résidentielle","drains français","déneigement commercial"],"arguments":["machinerie récente","estimation rapide","20 ans d''expérience"],"signature":"Excavation Lachance","a_eviter":["prix précis"],"phone":"450-555-0567","notes":"Pas de site web — le CTA des posts doit être CALL."}');

-- ============================================================
-- Reviews (~40)
-- Statuts variés : replied (historique), needs_reply (fraîches,
-- les drafts AI arrivent en phase 3), ignored, rating-only.
-- ============================================================
insert into public.reviews
  (client_id, gbp_review_id, gbp_review_name, reviewer_name, star_rating, comment, review_created_at, status)
values
  -- --- Toitures Bergeron (6) ---
  ('c0000000-0000-4000-8000-000000000001', 'rev-tb-001', 'accounts/108231694201573849275/locations/2801539874651203748/reviews/rev-tb-001',
   'Marc-André Fortin', 5, 'Toiture refaite en deux jours, équipe super propre, ils ont même passé l''aimant sur le terrain pour ramasser les clous. Je recommande à 100 %.',
   now() - interval '8 hours', 'needs_reply'),
  ('c0000000-0000-4000-8000-000000000001', 'rev-tb-002', 'accounts/108231694201573849275/locations/2801539874651203748/reviews/rev-tb-002',
   'Julie Tremblay', 2, 'Le travail est correct mais on a attendu 3 semaines de plus que prévu et personne ne retournait nos appels. Décevant côté communication.',
   now() - interval '2 days', 'needs_reply'),
  ('c0000000-0000-4000-8000-000000000001', 'rev-tb-003', 'accounts/108231694201573849275/locations/2801539874651203748/reviews/rev-tb-003',
   'Pierre Gagnon', 5, 'Excellent service, soumission claire, prix respecté. La nouvelle toiture a passé l''hiver sans problème.',
   now() - interval '45 days', 'replied'),
  ('c0000000-0000-4000-8000-000000000001', 'rev-tb-004', 'accounts/108231694201573849275/locations/2801539874651203748/reviews/rev-tb-004',
   'Sophie Bélanger', 4, 'Bon travail sur notre réparation d''urgence après la tempête. Un peu de retard le matin mais rien de grave.',
   now() - interval '60 days', 'replied'),
  ('c0000000-0000-4000-8000-000000000001', 'rev-tb-005', 'accounts/108231694201573849275/locations/2801539874651203748/reviews/rev-tb-005',
   'Kevin Williams', 5, 'Great crew, fast and clean work on our roof in Chomedey. Highly recommend!',
   now() - interval '90 days', 'replied'),
  ('c0000000-0000-4000-8000-000000000001', 'rev-tb-006', 'accounts/108231694201573849275/locations/2801539874651203748/reviews/rev-tb-006',
   'Utilisateur Google', 5, null,
   now() - interval '5 hours', 'needs_reply'),

  -- --- Garage Pro-Tech (6) ---
  ('c0000000-0000-4000-8000-000000000002', 'rev-gp-001', 'accounts/108231694201573849275/locations/5519274830165928374/reviews/rev-gp-001',
   'Nathalie Roy', 5, 'Enfin un garage honnête! Ils m''ont montré la pièce usée avant de la changer et l''estimation a été respectée au dollar près.',
   now() - interval '1 day', 'needs_reply'),
  ('c0000000-0000-4000-8000-000000000002', 'rev-gp-002', 'accounts/108231694201573849275/locations/5519274830165928374/reviews/rev-gp-002',
   'Steve Bergeron', 1, 'Rendez-vous à 8h, ma voiture n''a pas bougé avant 11h. J''ai perdu mon avant-midi. Aucune excuse offerte.',
   now() - interval '4 days', 'needs_reply'),
  ('c0000000-0000-4000-8000-000000000002', 'rev-gp-003', 'accounts/108231694201573849275/locations/5519274830165928374/reviews/rev-gp-003',
   'Isabelle Côté', 5, 'Service rapide pour mon changement de pneus, prix compétitif. Le café dans la salle d''attente est un plus!',
   now() - interval '30 days', 'replied'),
  ('c0000000-0000-4000-8000-000000000002', 'rev-gp-004', 'accounts/108231694201573849275/locations/5519274830165928374/reviews/rev-gp-004',
   'Mathieu Lavoie', 4, 'Bon diagnostic sur un bruit de suspension que deux autres garages n''avaient pas trouvé.',
   now() - interval '75 days', 'replied'),
  ('c0000000-0000-4000-8000-000000000002', 'rev-gp-005', 'accounts/108231694201573849275/locations/5519274830165928374/reviews/rev-gp-005',
   'John Miller', 4, 'Good honest mechanics. They explained everything clearly even with my limited French.',
   now() - interval '100 days', 'replied'),
  ('c0000000-0000-4000-8000-000000000002', 'rev-gp-006', 'accounts/108231694201573849275/locations/5519274830165928374/reviews/rev-gp-006',
   'Utilisateur Google', 1, null,
   now() - interval '6 days', 'needs_reply'),

  -- --- Paysagement Verdure (5) ---
  ('c0000000-0000-4000-8000-000000000003', 'rev-pv-001', 'accounts/108231694201573849275/locations/8837465102947586921/reviews/rev-pv-001',
   'Caroline Dubé', 5, 'Notre cour arrière est méconnaissable! Le pavé uni est magnifique et l''équipe a tout nettoyé avant de partir. Merci Verdure!',
   now() - interval '12 hours', 'needs_reply'),
  ('c0000000-0000-4000-8000-000000000003', 'rev-pv-002', 'accounts/108231694201573849275/locations/8837465102947586921/reviews/rev-pv-002',
   'François Pelletier', 3, 'Beau résultat final mais le chantier a traîné une semaine de plus, et la pelouse voisine a été un peu abîmée par la machinerie.',
   now() - interval '3 days', 'needs_reply'),
  ('c0000000-0000-4000-8000-000000000003', 'rev-pv-003', 'accounts/108231694201573849275/locations/8837465102947586921/reviews/rev-pv-003',
   'Mélanie Girard', 5, 'Design d''aménagement au-delà de nos attentes. On nous arrête dans la rue pour demander qui a fait ça!',
   now() - interval '40 days', 'replied'),
  ('c0000000-0000-4000-8000-000000000003', 'rev-pv-004', 'accounts/108231694201573849275/locations/8837465102947586921/reviews/rev-pv-004',
   'Daniel Morin', 5, 'Entretien saisonnier impeccable depuis 2 ans. Toujours ponctuels.',
   now() - interval '120 days', 'replied'),
  ('c0000000-0000-4000-8000-000000000003', 'rev-pv-005', 'accounts/108231694201573849275/locations/8837465102947586921/reviews/rev-pv-005',
   'Utilisateur Google', 4, null,
   now() - interval '15 days', 'ignored'),

  -- --- La Bella Vita (6) ---
  ('c0000000-0000-4000-8000-000000000004', 'rev-bv-001', 'accounts/108231694201573849275/locations/1120394857610293847/reviews/rev-bv-001',
   'Amélie Lachapelle', 5, 'Les pâtes carbonara sont divines et le service de Marco est toujours impeccable. Notre resto de quartier préféré depuis des années.',
   now() - interval '10 hours', 'needs_reply'),
  ('c0000000-0000-4000-8000-000000000004', 'rev-bv-002', 'accounts/108231694201573849275/locations/1120394857610293847/reviews/rev-bv-002',
   'Simon Beaulieu', 2, 'Pizza correcte mais 45 minutes d''attente un mardi soir tranquille, et mon plat est arrivé tiède. Pas l''expérience habituelle.',
   now() - interval '1 day', 'needs_reply'),
  ('c0000000-0000-4000-8000-000000000004', 'rev-bv-003', 'accounts/108231694201573849275/locations/1120394857610293847/reviews/rev-bv-003',
   'Sarah Thompson', 5, 'Best tiramisu in Montreal, hands down. Lovely family atmosphere.',
   now() - interval '2 days', 'needs_reply'),
  ('c0000000-0000-4000-8000-000000000004', 'rev-bv-004', 'accounts/108231694201573849275/locations/1120394857610293847/reviews/rev-bv-004',
   'Vincent Paradis', 5, 'Soirée parfaite pour notre anniversaire de mariage. Le chef est venu nous saluer!',
   now() - interval '25 days', 'replied'),
  ('c0000000-0000-4000-8000-000000000004', 'rev-bv-005', 'accounts/108231694201573849275/locations/1120394857610293847/reviews/rev-bv-005',
   'Chantal Lemieux', 4, 'Très bonne cuisine, portions généreuses. Le stationnement est difficile dans le coin par contre.',
   now() - interval '50 days', 'replied'),
  ('c0000000-0000-4000-8000-000000000004', 'rev-bv-006', 'accounts/108231694201573849275/locations/1120394857610293847/reviews/rev-bv-006',
   'Utilisateur Google', 5, null,
   now() - interval '20 days', 'replied'),

  -- --- Plomberie Riviera (5) ---
  ('c0000000-0000-4000-8000-000000000005', 'rev-pr-001', 'accounts/108231694201573849275/locations/6647382910573829105/reviews/rev-pr-001',
   'Éric Bouchard', 5, 'Chauffe-eau brisé un dimanche soir, technicien chez nous en 1h30. Sauvé notre fin de semaine. Merci!',
   now() - interval '4 hours', 'needs_reply'),
  ('c0000000-0000-4000-8000-000000000005', 'rev-pr-002', 'accounts/108231694201573849275/locations/6647382910573829105/reviews/rev-pr-002',
   'Linda Sauvé', 1, 'Facture beaucoup plus élevée que l''estimation verbale au téléphone. Je me suis sentie prise en otage une fois les travaux commencés.',
   now() - interval '5 days', 'needs_reply'),
  ('c0000000-0000-4000-8000-000000000005', 'rev-pr-003', 'accounts/108231694201573849275/locations/6647382910573829105/reviews/rev-pr-003',
   'Guillaume Fortier', 5, 'Débouchage de drain efficace, plombier courtois qui a bien protégé les planchers.',
   now() - interval '35 days', 'replied'),
  ('c0000000-0000-4000-8000-000000000005', 'rev-pr-004', 'accounts/108231694201573849275/locations/6647382910573829105/reviews/rev-pr-004',
   'Suzanne Leblanc', 4, 'Bon service pour le remplacement de notre chauffe-eau. Ponctuel et propre.',
   now() - interval '80 days', 'replied'),
  ('c0000000-0000-4000-8000-000000000005', 'rev-pr-005', 'accounts/108231694201573849275/locations/6647382910573829105/reviews/rev-pr-005',
   'Utilisateur Google', 5, null,
   now() - interval '10 days', 'replied'),

  -- --- Électricité Dumont (4) ---
  ('c0000000-0000-4000-8000-000000000006', 'rev-ed-001', 'accounts/108231694201573849275/locations/3958271046382910576/reviews/rev-ed-001',
   'Patrick Nadeau', 5, 'Installation de ma borne de recharge faite en une matinée, travail super propre, tout expliqué clairement. Rien à redire.',
   now() - interval '18 hours', 'needs_reply'),
  ('c0000000-0000-4000-8000-000000000006', 'rev-ed-002', 'accounts/108231694201573849275/locations/3958271046382910576/reviews/rev-ed-002',
   'Marie-Claude Bissonnette', 5, 'Mise aux normes de notre vieux panneau électrique. Équipe professionnelle, on se sent en sécurité maintenant.',
   now() - interval '55 days', 'replied'),
  ('c0000000-0000-4000-8000-000000000006', 'rev-ed-003', 'accounts/108231694201573849275/locations/3958271046382910576/reviews/rev-ed-003',
   'Robert Chen', 4, 'Professional EV charger installation. Slightly delayed start but great communication throughout.',
   now() - interval '85 days', 'replied'),
  ('c0000000-0000-4000-8000-000000000006', 'rev-ed-004', 'accounts/108231694201573849275/locations/3958271046382910576/reviews/rev-ed-004',
   'Utilisateur Google', 3, null,
   now() - interval '9 days', 'needs_reply'),

  -- --- Clinique Sourire Plus (4) ---
  ('c0000000-0000-4000-8000-000000000007', 'rev-cs-001', 'accounts/108231694201573849275/locations/7261849305718293645/reviews/rev-cs-001',
   'Valérie Ouellet', 5, 'J''avais une phobie du dentiste et l''équipe a été d''une patience incroyable avec moi. Je n''ai plus peur d''y retourner!',
   now() - interval '20 hours', 'needs_reply'),
  ('c0000000-0000-4000-8000-000000000007', 'rev-cs-002', 'accounts/108231694201573849275/locations/7261849305718293645/reviews/rev-cs-002',
   'Alexandre Lapointe', 2, 'Deux reports de rendez-vous en un mois et 40 minutes d''attente à ma visite. Le personnel est gentil mais l''horaire ne tient pas.',
   now() - interval '3 days', 'needs_reply'),
  ('c0000000-0000-4000-8000-000000000007', 'rev-cs-003', 'accounts/108231694201573849275/locations/7261849305718293645/reviews/rev-cs-003',
   'Josée Marchand', 5, 'Excellente clinique familiale, mes enfants adorent y aller (oui oui, chez le dentiste!).',
   now() - interval '65 days', 'replied'),
  ('c0000000-0000-4000-8000-000000000007', 'rev-cs-004', 'accounts/108231694201573849275/locations/7261849305718293645/reviews/rev-cs-004',
   'Utilisateur Google', 5, null,
   now() - interval '30 days', 'replied'),

  -- --- Excavation Lachance (4) ---
  ('c0000000-0000-4000-8000-000000000008', 'rev-el-001', 'accounts/108231694201573849275/locations/4830192756483920175/reviews/rev-el-001',
   'Benoît Grenier', 5, 'Drain français installé rapidement malgré un terrain difficile. Machinerie impressionnante et opérateur d''expérience.',
   now() - interval '30 hours', 'needs_reply'),
  ('c0000000-0000-4000-8000-000000000008', 'rev-el-002', 'accounts/108231694201573849275/locations/4830192756483920175/reviews/rev-el-002',
   'Diane Perreault', 4, 'Déneigement commercial fiable tout l''hiver. Quelques passages tardifs en tempête mais globalement satisfaite.',
   now() - interval '95 days', 'replied'),
  ('c0000000-0000-4000-8000-000000000008', 'rev-el-003', 'accounts/108231694201573849275/locations/4830192756483920175/reviews/rev-el-003',
   'Martin Asselin', 5, 'Excavation pour notre agrandissement faite dans les temps et le budget. Équipe franche et travaillante.',
   now() - interval '130 days', 'replied'),
  ('c0000000-0000-4000-8000-000000000008', 'rev-el-004', 'accounts/108231694201573849275/locations/4830192756483920175/reviews/rev-el-004',
   'Utilisateur Google', 2, null,
   now() - interval '7 days', 'needs_reply');

-- ============================================================
-- Réponses publiées pour les reviews 'replied' (historique)
-- ============================================================
insert into public.review_replies (review_id, draft_text, published_text, generated_by_ai, published_at)
select
  r.id,
  'Merci beaucoup pour votre confiance! Au plaisir de vous revoir. — ' || (c.brand_profile->>'signature'),
  'Merci beaucoup pour votre confiance! Au plaisir de vous revoir. — ' || (c.brand_profile->>'signature'),
  false,
  r.review_created_at + interval '1 day'
from public.reviews r
join public.clients c on c.id = r.client_id
where r.status = 'replied';

-- ============================================================
-- Posts historiques + un planifié
-- ============================================================
insert into public.posts (client_id, summary, cta_type, cta_url, status, scheduled_for, published_at, gbp_post_name, generated_by_ai, angle)
values
  ('c0000000-0000-4000-8000-000000000001',
   'Le printemps est le moment idéal pour inspecter votre toiture après les rigueurs de l''hiver. Bardeaux soulevés, clous sortis, gouttières obstruées : ces petits signes peuvent devenir de gros problèmes. Notre équipe offre une inspection complète et une soumission gratuite partout à Laval. Prenez une longueur d''avance sur la saison des pluies!',
   'LEARN_MORE', 'https://toituresbergeron.ca', 'published',
   null, now() - interval '40 days', 'accounts/108231694201573849275/locations/2801539874651203748/localPosts/lp-tb-001',
   true, 'conseil saisonnier'),
  ('c0000000-0000-4000-8000-000000000002',
   'Vos pneus d''été sont-ils prêts? Un alignement vérifié au changement de pneus, c''est une usure uniforme et une meilleure tenue de route tout l''été. Chez Pro-Tech, on vous montre l''état réel de vos pièces avant tout travail — pas de surprise sur la facture. Prenez rendez-vous dès maintenant.',
   'LEARN_MORE', 'https://garageprotech.ca', 'published',
   null, now() - interval '50 days', 'accounts/108231694201573849275/locations/5519274830165928374/localPosts/lp-gp-001',
   true, 'conseil saisonnier'),
  ('c0000000-0000-4000-8000-000000000004',
   'Ce mois-ci, notre chef met à l''honneur les asperges du Québec : risotto crémeux aux asperges et citron, disponible en salle et pour emporter. Nos pâtes sont toujours fraîches du matin, comme depuis 1998. Réservez votre table — la terrasse est ouverte! 🌿',
   'LEARN_MORE', 'https://labellavita.ca', 'published',
   null, now() - interval '12 days', 'accounts/108231694201573849275/locations/1120394857610293847/localPosts/lp-bv-001',
   true, 'service mis de l''avant'),
  ('c0000000-0000-4000-8000-000000000003',
   'Un terrain qui fait tourner les têtes, ça commence par un bon design. Découvrez nos plus récentes réalisations de pavé uni et d''aménagement complet à Terrebonne et dans les environs. Consultation sans frais pour les projets d''été — les places partent vite!',
   'LEARN_MORE', 'https://paysagementverdure.ca', 'scheduled',
   now() + interval '3 days', null, null,
   true, 'réalisation récente');
