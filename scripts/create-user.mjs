// Crée un compte auth (email confirmé d'office) — le formulaire de
// login ne fait que signIn, pas de signup (whitelist oblige).
// Usage : pnpm create-user <email> <mot-de-passe>
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const [email, password] = process.argv.slice(2);

if (!url || !serviceKey) {
  console.error(
    "NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis (remplir .env.local).",
  );
  process.exit(1);
}
if (!email || !password) {
  console.error("Usage : pnpm create-user <email> <mot-de-passe>");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});

if (error) {
  console.error("Création échouée :", error.message);
  process.exit(1);
}

// Le trigger on_auth_user_created lie user_id à la whitelist par email.
const { data: member } = await supabase
  .from("agency_members")
  .select("role, user_id")
  .eq("email", email.toLowerCase())
  .maybeSingle();

console.log(`Compte créé : ${data.user.email} (${data.user.id})`);
if (member?.user_id === data.user.id) {
  console.log(`Whitelist liée — rôle : ${member.role}. Tu peux te connecter.`);
} else {
  console.warn(
    "⚠️ Ce courriel n'est pas dans la whitelist agency_members — l'app affichera « accès refusé ».",
  );
}
