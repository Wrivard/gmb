# 03 — Base de données (Supabase Postgres)

Migrations SQL dans `supabase/migrations/`. Tout en `snake_case`. `uuid` PK par défaut (`gen_random_uuid()`), `created_at/updated_at timestamptz` partout (trigger `updated_at`).

## Tables

### `agencies`
| colonne | type | notes |
|---|---|---|
| id | uuid PK | |
| name | text | « Küa » |
| default_posts_per_month | int | défaut 2 |
| default_language | text | 'fr-CA' |

### `agency_members`
| id | uuid PK |
| agency_id | uuid FK agencies |
| user_id | uuid FK auth.users, unique |
| email | text unique | whitelist de login |
| role | text | 'owner' \| 'member' |

### `google_connections`
| id | uuid PK |
| agency_id | uuid FK, unique | une connexion active par agence |
| google_email | text | compte connecté |
| refresh_token_encrypted | text | AES-256-GCM |
| status | text | 'active' \| 'revoked' |
| connected_at / last_refreshed_at | timestamptz |

### `clients` (= une location GBP)
| id | uuid PK |
| agency_id | uuid FK |
| gbp_account_id | text | `accounts/{id}` |
| gbp_location_id | text unique | `locations/{id}` |
| name | text | éditable (défaut = title GBP) |
| address / phone / website / primary_category | text | snapshot de la fiche |
| status | text | 'active' \| 'paused' \| 'disconnected' |
| posts_per_month | int | défaut hérité de l'agence |
| auto_publish_replies | bool défaut false | publier les réponses AI sans approbation |
| auto_publish_posts | bool défaut false |
| language | text défaut 'fr-CA' |
| brand_profile | jsonb | ton, services clés, ville, signature, mots à éviter — voir `07-AI-ENGINE.md` |
| last_synced_at | timestamptz |

### `reviews`
| id | uuid PK |
| client_id | uuid FK |
| gbp_review_id | text unique | reviewId Google |
| gbp_review_name | text | resource name complet `accounts/.../reviews/...` (nécessaire pour le reply PUT) |
| reviewer_name / reviewer_photo_url | text |
| star_rating | int | 1–5 (mapper l'enum Google) |
| comment | text nullable | review « rating only » possible |
| review_created_at / review_updated_at | timestamptz |
| status | text | 'needs_reply' \| 'draft_ready' \| 'approved' \| 'replied' \| 'ignored' |
| synced_at | timestamptz |

### `review_replies`
| id | uuid PK |
| review_id | uuid FK unique |
| draft_text | text | dernière génération AI ou édition humaine |
| published_text | text nullable |
| generated_by_ai | bool |
| generation_count | int | nb de régénérations |
| approved_by | uuid FK agency_members nullable |
| published_at | timestamptz nullable |
| publish_error | text nullable |

### `posts`
| id | uuid PK |
| client_id | uuid FK |
| type | text | 'STANDARD' (MVP; 'EVENT'/'OFFER' post-MVP) |
| summary | text | corps du post (max 1500 chars) |
| cta_type | text nullable | 'LEARN_MORE' \| 'CALL' \| 'BOOK' \| 'ORDER' \| 'SIGN_UP' |
| cta_url | text nullable |
| image_path | text nullable | chemin Supabase Storage |
| image_prompt | text nullable | prompt utilisé pour l'image |
| status | text | 'draft' \| 'approved' \| 'scheduled' \| 'publishing' \| 'published' \| 'failed' |
| scheduled_for | timestamptz nullable |
| published_at | timestamptz nullable |
| gbp_post_name | text nullable | resource name retourné par Google |
| publish_error | text nullable |
| generated_by_ai | bool |
| approved_by | uuid nullable |

### `activity_log`
| id | uuid PK |
| agency_id / client_id | uuid |
| actor | text | email membre ou 'system' ou 'ai' |
| action | text | 'reply_published', 'post_published', 'sync_completed', 'generation', 'error', … |
| payload | jsonb |
| created_at | timestamptz |

## Index

- `reviews (client_id, status)`, `reviews (review_created_at desc)`
- `posts (client_id, status)`, `posts (scheduled_for) where status='scheduled'`
- `clients (agency_id, status)`

## Vue matérialisée légère (ou vue simple) : `client_board_state`

Vue SQL calculant par client : `unreplied_count` (reviews `needs_reply`/`draft_ready`), `posts_published_this_month`, `posts_due` (= posts_per_month - publiés - planifiés ce mois, min 0), `next_scheduled_post`. Alimente le kanban. Une vue simple suffit à 30 clients — pas de matérialisation nécessaire.

## RLS

- Activer RLS sur toutes les tables.
- Policy générique : `agency_id IN (SELECT agency_id FROM agency_members WHERE user_id = auth.uid())` (pour les tables sans agency_id direct : joindre via client_id).
- Les crons/route handlers serveur utilisent `SUPABASE_SERVICE_ROLE_KEY` (bypass RLS).
- Bucket Storage `post-images` : lecture publique (requis pour `sourceUrl`), écriture service-role seulement. Chemins : `post-images/{client_id}/{post_id}.png`.

## Seed (mode mock)

Script `supabase/seed.sql` + fixtures : 1 agence, 2 membres, 8 clients québécois réalistes, ~40 reviews variées (1–5 étoiles, avec/sans commentaire, français majoritaire + quelques anglaises), quelques posts historiques. Les données mock doivent être crédibles — c'est ce qui permet de valider l'UX.
