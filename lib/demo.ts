// Données d'exemple statiques — affichées quand Supabase n'est pas
// configuré, pour que l'UI reste navigable (design/démo sans backend).
// Les dates sont relatives au moment du render pour que les badges
// d'ancienneté (« il y a 2 jours », retard > 72 h) restent plausibles.
import type { BoardClient } from "@/app/(app)/kanban";
import type { InboxReview } from "@/lib/reviews/inbox";
import type { QueueClient, QueuePost } from "@/lib/posts/queue";
import type { ClientGrowth } from "@/lib/clients/growth";

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3600_000).toISOString();
}

function inHours(hours: number): string {
  return new Date(Date.now() + hours * 3600_000).toISOString();
}

export function demoBoardClients(): BoardClient[] {
  return [
    {
      id: "demo-plomberie",
      name: "Plomberie Riviera",
      category: "Plombier",
      city: "Laval",
      unreplied: 3,
      worstPendingRating: 2,
      postsDue: 1,
      postsPerMonth: 2,
      draftReplies: 2,
      draftPosts: 0,
      failedPosts: 0,
      avgRating: 4.6,
      reviewCount: 87,
      late: true,
      assigneeMemberId: null,
      profileIncomplete: false,
    },
    {
      id: "demo-toitures",
      name: "Toitures Bergeron",
      category: "Couvreur",
      city: "Terrebonne",
      unreplied: 1,
      worstPendingRating: 5,
      postsDue: 0,
      postsPerMonth: 2,
      draftReplies: 1,
      draftPosts: 1,
      failedPosts: 0,
      avgRating: 4.9,
      reviewCount: 42,
      late: false,
      assigneeMemberId: null,
      profileIncomplete: false,
    },
    {
      id: "demo-dentiste",
      name: "Clinique Dentaire Sourire Plus",
      category: "Dentiste",
      city: "Sainte-Thérèse",
      unreplied: 0,
      worstPendingRating: null,
      postsDue: 2,
      postsPerMonth: 3,
      draftReplies: 0,
      draftPosts: 0,
      failedPosts: 0,
      avgRating: 4.3,
      reviewCount: 128,
      late: false,
      assigneeMemberId: null,
      profileIncomplete: false,
    },
    {
      id: "demo-electricite",
      name: "Électricité Dumont",
      category: "Électricien",
      city: "Brossard",
      unreplied: 0,
      worstPendingRating: null,
      postsDue: 1,
      postsPerMonth: 2,
      draftReplies: 0,
      draftPosts: 0,
      failedPosts: 0,
      avgRating: 4.7,
      reviewCount: 63,
      late: false,
      assigneeMemberId: null,
      profileIncomplete: false,
    },
    {
      id: "demo-resto",
      name: "Restaurant La Bella Vita",
      category: "Restaurant italien",
      city: "Longueuil",
      unreplied: 0,
      worstPendingRating: null,
      postsDue: 0,
      postsPerMonth: 2,
      draftReplies: 1,
      draftPosts: 2,
      failedPosts: 0,
      avgRating: 4.4,
      reviewCount: 214,
      late: false,
      assigneeMemberId: null,
      profileIncomplete: false,
    },
    {
      id: "demo-paysagement",
      name: "Paysagement Verdure",
      category: "Paysagiste",
      city: "Mirabel",
      unreplied: 0,
      worstPendingRating: null,
      postsDue: 0,
      postsPerMonth: 2,
      draftReplies: 0,
      draftPosts: 1,
      failedPosts: 0,
      avgRating: 4.8,
      reviewCount: 39,
      late: false,
      assigneeMemberId: null,
      profileIncomplete: false,
    },
    {
      id: "demo-garage",
      name: "Garage Pro-Tech Mécanique",
      category: "Atelier de réparation automobile",
      city: "Longueuil",
      unreplied: 0,
      worstPendingRating: null,
      postsDue: 0,
      postsPerMonth: 2,
      draftReplies: 0,
      draftPosts: 0,
      // Cohérent avec demoQueuePosts : son post « Pneus d'été » est failed.
      failedPosts: 1,
      avgRating: 4.1,
      reviewCount: 96,
      late: false,
      assigneeMemberId: null,
      profileIncomplete: false,
    },
    {
      id: "demo-excavation",
      name: "Excavation Lachance",
      category: "Entrepreneur en excavation",
      city: "Mirabel",
      unreplied: 0,
      worstPendingRating: null,
      postsDue: 0,
      postsPerMonth: 2,
      draftReplies: 0,
      draftPosts: 0,
      failedPosts: 0,
      avgRating: 4.5,
      reviewCount: 27,
      late: false,
      assigneeMemberId: null,
      profileIncomplete: false,
    },
  ];
}

export function demoInboxReviews(): InboxReview[] {
  return [
    {
      id: "demo-r1",
      clientId: "demo-plomberie",
      clientName: "Plomberie Riviera",
      reviewerName: "Éric Bouchard",
      starRating: 5,
      comment:
        "Chauffe-eau brisé un dimanche soir, technicien chez nous en 1h30. Sauvé notre fin de semaine. Merci!",
      createdAt: hoursAgo(20),
      status: "draft_ready",
      wasUpdated: false,
      draftText:
        "Merci Éric! Un chauffe-eau qui lâche un dimanche soir, on sait à quel point c'est stressant — content qu'on ait pu être là rapidement. Au plaisir!",
      publishedText: null,
      generationCount: 1,
    },
    {
      id: "demo-r2",
      clientId: "demo-plomberie",
      clientName: "Plomberie Riviera",
      reviewerName: "Sylvie Tremblay",
      starRating: 2,
      comment:
        "Le travail est correct mais le technicien est arrivé avec 2 heures de retard et personne ne m'a prévenue.",
      createdAt: hoursAgo(78),
      status: "needs_reply",
      wasUpdated: false,
      draftText: null,
      publishedText: null,
      generationCount: 0,
    },
    {
      id: "demo-r3",
      clientId: "demo-toitures",
      clientName: "Toitures Bergeron",
      reviewerName: "Marc-André Fortin",
      starRating: 5,
      comment:
        "Toiture refaite en deux jours, équipe super propre, ils ont même passé l'aimant sur le terrain pour ramasser les clous. Je recommande à 100 %.",
      createdAt: hoursAgo(30),
      status: "draft_ready",
      wasUpdated: false,
      draftText:
        "Merci Marc-André! L'aimant fait partie de la routine — pas question de laisser un clou derrière nous. Bonne saison sans souci de toiture!",
      publishedText: null,
      generationCount: 3,
    },
    {
      id: "demo-r4",
      clientId: "demo-resto",
      clientName: "Restaurant La Bella Vita",
      reviewerName: "Utilisateur Google",
      starRating: 4,
      comment: null,
      createdAt: hoursAgo(50),
      status: "draft_ready",
      wasUpdated: false,
      draftText: "Merci pour votre visite! Au plaisir de vous revoir bientôt.",
      publishedText: null,
      generationCount: 1,
    },
    {
      id: "demo-r5",
      clientId: "demo-resto",
      clientName: "Restaurant La Bella Vita",
      reviewerName: "Simon Beaulieu",
      starRating: 2,
      comment:
        "Pizza correcte mais 45 minutes d'attente un mardi soir tranquille, et mon plat est arrivé tiède. Pas l'expérience habituelle.",
      createdAt: hoursAgo(96),
      status: "draft_ready",
      wasUpdated: true,
      draftText:
        "Bonjour Simon, merci d'avoir pris le temps de nous écrire. 45 minutes un mardi soir, ce n'est pas notre standard — on aimerait comprendre ce qui s'est passé. Écrivez-nous, votre prochaine pizza est pour nous.",
      publishedText: null,
      generationCount: 2,
    },
    {
      id: "demo-r6",
      clientId: "demo-dentiste",
      clientName: "Clinique Dentaire Sourire Plus",
      reviewerName: "Valérie Ouellet",
      starRating: 5,
      comment:
        "J'avais une phobie du dentiste et l'équipe a été d'une patience incroyable avec moi. Je n'ai plus peur d'y retourner!",
      createdAt: hoursAgo(120),
      status: "replied",
      wasUpdated: false,
      draftText: null,
      publishedText:
        "Merci Valérie, votre confiance nous touche beaucoup. À bientôt pour votre prochain rendez-vous!",
      generationCount: 1,
    },
    {
      id: "demo-r7",
      clientId: "demo-garage",
      clientName: "Garage Pro-Tech Mécanique",
      reviewerName: "Nathalie Roy",
      starRating: 5,
      comment:
        "Enfin un garage honnête! Ils m'ont montré la pièce usée avant de la changer et l'estimation a été respectée au dollar près.",
      createdAt: hoursAgo(140),
      status: "replied",
      wasUpdated: false,
      draftText: null,
      publishedText:
        "Merci Nathalie! La transparence, c'est la base — on vous montre toujours ce qu'on remplace. Bonne route!",
      generationCount: 1,
    },
    {
      id: "demo-r8",
      clientId: "demo-electricite",
      clientName: "Électricité Dumont",
      reviewerName: "Patrick Nadeau",
      starRating: 1,
      comment: "Jamais rappelé après deux messages.",
      createdAt: hoursAgo(8),
      status: "needs_reply",
      wasUpdated: false,
      draftText: null,
      publishedText: null,
      generationCount: 0,
    },
    {
      id: "demo-r9",
      clientId: "demo-excavation",
      clientName: "Excavation Lachance",
      reviewerName: "Julie Bélanger",
      starRating: 3,
      comment: "Bon travail mais le terrain est resté boueux plus longtemps que prévu.",
      createdAt: hoursAgo(200),
      status: "ignored",
      wasUpdated: false,
      draftText: null,
      publishedText: null,
      generationCount: 0,
    },
  ];
}

export function demoQueueClients(): QueueClient[] {
  return [
    { id: "demo-dentiste", name: "Clinique Dentaire Sourire Plus", remaining: 2, late: false },
    { id: "demo-plomberie", name: "Plomberie Riviera", remaining: 1, late: true },
    { id: "demo-electricite", name: "Électricité Dumont", remaining: 1, late: false },
  ];
}

export function demoQueuePosts(): QueuePost[] {
  return [
    {
      id: "demo-p1",
      clientId: "demo-toitures",
      clientName: "Toitures Bergeron",
      summary:
        "Le printemps est le bon moment pour inspecter les bardeaux après le dégel. On grimpe, on photographie, on vous explique — sans frais.",
      status: "draft",
      scheduledFor: null,
      publishedAt: null,
      publishError: null,
      imageUrl: "https://picsum.photos/seed/toiture/1200/900",
    },
    {
      id: "demo-p2",
      clientId: "demo-resto",
      clientName: "Restaurant La Bella Vita",
      summary:
        "Nouveau menu du midi dès lundi : pâtes fraîches maison, entrée + plat en 45 minutes chrono pour les gens pressés.",
      status: "draft",
      scheduledFor: null,
      publishedAt: null,
      publishError: null,
      imageUrl: null,
    },
    {
      id: "demo-p3",
      clientId: "demo-paysagement",
      clientName: "Paysagement Verdure",
      summary:
        "Un terrain qui fait tourner les têtes, ça commence par un bon design. Découvrez nos plus récentes réalisations à Mirabel.",
      status: "scheduled",
      scheduledFor: inHours(40),
      publishedAt: null,
      publishError: null,
      imageUrl: "https://picsum.photos/seed/paysage/1200/900",
    },
    {
      id: "demo-p4",
      clientId: "demo-resto",
      clientName: "Restaurant La Bella Vita",
      summary:
        "Merci pour un mois de mai record! En juin, la terrasse ouvre dès 16 h du jeudi au dimanche.",
      status: "approved",
      scheduledFor: inHours(90),
      publishedAt: null,
      publishError: null,
      imageUrl: null,
    },
    {
      id: "demo-p5",
      clientId: "demo-garage",
      clientName: "Garage Pro-Tech Mécanique",
      summary:
        "Pneus d'été : prise de rendez-vous en ligne maintenant disponible, installation en 50 minutes.",
      status: "failed",
      scheduledFor: hoursAgo(30),
      publishedAt: null,
      publishError: "REJECTED : le contenu a été refusé par Google (lien non joignable).",
      imageUrl: null,
    },
    {
      id: "demo-p6",
      clientId: "demo-electricite",
      clientName: "Électricité Dumont",
      summary:
        "Borne de recharge à la maison : subvention Roulez vert de retour, on s'occupe de la demande pour vous.",
      status: "published",
      scheduledFor: hoursAgo(120),
      publishedAt: hoursAgo(118),
      publishError: null,
      imageUrl: "https://picsum.photos/seed/borne/1200/900",
    },
  ];
}

export interface DemoActivityEntry {
  id: string;
  label: string;
  actor: string;
  at: string;
}

export function demoActivity(): DemoActivityEntry[] {
  return [
    { id: "a1", label: "Réponse publiée", actor: "wrivard@kua.quebec", at: hoursAgo(3) },
    { id: "a2", label: "Post généré", actor: "wrivard@kua.quebec", at: hoursAgo(20) },
    { id: "a3", label: "Réponse auto-publiée", actor: "Système", at: hoursAgo(26) },
    { id: "a4", label: "Sync terminé", actor: "Système", at: hoursAgo(31) },
    { id: "a5", label: "Post publié", actor: "Système", at: hoursAgo(50) },
  ];
}

export interface DemoClientRow {
  id: string;
  name: string;
  address: string | null;
  primary_category: string | null;
  posts_per_month: number;
  status: "active" | "paused" | "disconnected";
}

export function demoClientRows(): DemoClientRow[] {
  const cities: Record<string, string> = {
    "demo-plomberie": "1240 boul. des Laurentides, Laval, QC",
    "demo-toitures": "88 rue Saint-Louis, Terrebonne, QC",
    "demo-dentiste": "220 rue Blainville O., Sainte-Thérèse, QC",
    "demo-electricite": "5620 boul. Taschereau, Brossard, QC",
    "demo-resto": "1355 chemin de Chambly, Longueuil, QC",
    "demo-paysagement": "13400 boul. du Curé-Labelle, Mirabel, QC",
    "demo-garage": "2915 rue Sainte-Hélène, Longueuil, QC",
    "demo-excavation": "10250 rue Victor, Mirabel, QC",
  };
  return demoBoardClients().map((client, index) => ({
    id: client.id,
    name: client.name,
    address: cities[client.id] ?? null,
    primary_category: client.category,
    posts_per_month: index % 3 === 0 ? 2 : 1,
    status: index === 7 ? "paused" : "active",
  }));
}

const MONTH_LABELS_FR = [
  "janv.",
  "févr.",
  "mars",
  "avr.",
  "mai",
  "juin",
  "juil.",
  "août",
  "sept.",
  "oct.",
  "nov.",
  "déc.",
];

export function demoClientGrowth(): ClientGrowth {
  const now = new Date();
  const reviews = [7, 8, 6, 9, 11, 4];
  const avg = [4.3, 4.4, 4.4, 4.5, 4.6, 4.6];
  const published = [2, 2, 1, 2, 2, 1];
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return {
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: MONTH_LABELS_FR[d.getMonth()],
      reviews: reviews[i],
      avgCumulative: avg[i],
      postsPublished: published[i],
      postsTarget: 2,
    };
  });
  return {
    months,
    avgRating: 4.6,
    avgDelta6m: 0.3,
    responseRate: { replied: 36, total: 39 },
    medianResponseHours: 6,
  };
}
