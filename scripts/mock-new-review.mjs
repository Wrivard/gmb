// Insère une review fake aléatoire pour tester le flow en dev (specs/04).
// Usage : pnpm mock:new-review
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis (remplir .env.local).",
  );
  process.exit(1);
}

const REVIEWERS = [
  "Luc Bouchard",
  "Émilie Paradis",
  "Jean-François Nadeau",
  "Karine Ouellet",
  "Sarah Thompson",
  "Maxime Leblanc",
  null, // anonyme
];

const TEMPLATES = [
  { rating: 5, comment: "Service impeccable, je recommande sans hésiter!" },
  { rating: 5, comment: "Équipe professionnelle et ponctuelle. Très satisfait du résultat." },
  { rating: 4, comment: "Bon travail dans l'ensemble, petit délai au départ mais rien de majeur." },
  { rating: 3, comment: "Résultat correct, mais la communication pourrait être améliorée." },
  { rating: 2, comment: "Déçu du suivi — j'ai dû rappeler trois fois pour avoir des nouvelles." },
  { rating: 1, comment: "Rendez-vous manqué sans avertissement. Expérience frustrante." },
  { rating: 5, comment: null }, // note sans commentaire
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

const supabase = createClient(url, serviceKey);

const { data: clients, error: clientsError } = await supabase
  .from("clients")
  .select("id, name, gbp_account_id, gbp_location_id")
  .eq("status", "active");

if (clientsError) {
  console.error("Lecture des clients échouée :", clientsError.message);
  process.exit(1);
}
if (!clients?.length) {
  console.error("Aucun client actif — lancer le seed d'abord.");
  process.exit(1);
}

const client = pick(clients);
const template = pick(TEMPLATES);
const reviewer = pick(REVIEWERS);
const reviewId = `rev-mock-${Date.now().toString(36)}`;
const now = new Date().toISOString();

const { error: insertError } = await supabase.from("reviews").insert({
  client_id: client.id,
  gbp_review_id: reviewId,
  gbp_review_name: `accounts/${client.gbp_account_id}/locations/${client.gbp_location_id}/reviews/${reviewId}`,
  reviewer_name: reviewer,
  star_rating: template.rating,
  comment: template.comment,
  review_created_at: now,
  status: "needs_reply",
});

if (insertError) {
  console.error("Insertion échouée :", insertError.message);
  process.exit(1);
}

console.log(
  `Review fake insérée pour « ${client.name} » : ${template.rating}★ — ${
    reviewer ?? "(anonyme)"
  }${template.comment ? ` — « ${template.comment} »` : " (sans commentaire)"}`,
);
