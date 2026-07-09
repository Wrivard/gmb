// Types de la base Supabase — écrits à la main depuis
// supabase/migrations/20260701000001_init.sql (pas de stack locale dispo).
// À régénérer via `supabase gen types typescript` quand un projet sera lié.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type MemberRole = "owner" | "member";
export type ConnectionStatus = "active" | "revoked";
export type ClientStatus = "active" | "paused" | "disconnected" | "archived";
export type ReviewStatus =
  | "needs_reply"
  | "draft_ready"
  | "approved"
  | "replied"
  | "ignored";
export type PostType = "STANDARD" | "EVENT" | "OFFER";
export type CtaType = "LEARN_MORE" | "CALL" | "BOOK" | "ORDER" | "SIGN_UP";
export type PostStatus =
  | "draft"
  | "approved"
  | "scheduled"
  | "publishing"
  | "published"
  | "failed";

export interface BrandProfile {
  tone?: string;
  vertical?: string;
  city?: string;
  services_cles?: string[];
  arguments?: string[];
  signature?: string;
  a_eviter?: string[];
  phone?: string;
  notes?: string;
}

export interface Database {
  public: {
    Tables: {
      agencies: {
        Row: {
          id: string;
          name: string;
          default_posts_per_month: number;
          default_language: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          default_posts_per_month?: number;
          default_language?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          default_posts_per_month?: number;
          default_language?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      agency_members: {
        Row: {
          id: string;
          agency_id: string;
          user_id: string | null;
          email: string;
          role: MemberRole;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          agency_id: string;
          user_id?: string | null;
          email: string;
          role?: MemberRole;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          agency_id?: string;
          user_id?: string | null;
          email?: string;
          role?: MemberRole;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      google_connections: {
        Row: {
          id: string;
          agency_id: string;
          google_email: string;
          refresh_token_encrypted: string;
          status: ConnectionStatus;
          connected_at: string;
          last_refreshed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          agency_id: string;
          google_email: string;
          refresh_token_encrypted: string;
          status?: ConnectionStatus;
          connected_at?: string;
          last_refreshed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          agency_id?: string;
          google_email?: string;
          refresh_token_encrypted?: string;
          status?: ConnectionStatus;
          connected_at?: string;
          last_refreshed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      clients: {
        Row: {
          id: string;
          agency_id: string;
          gbp_account_id: string;
          gbp_location_id: string;
          name: string;
          address: string | null;
          phone: string | null;
          website: string | null;
          primary_category: string | null;
          status: ClientStatus;
          posts_per_month: number;
          auto_publish_replies: boolean;
          auto_publish_posts: boolean;
          language: string;
          brand_profile: BrandProfile;
          assignee_member_id: string | null;
          internal_notes: string | null;
          last_synced_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          agency_id: string;
          gbp_account_id: string;
          gbp_location_id: string;
          name: string;
          address?: string | null;
          phone?: string | null;
          website?: string | null;
          primary_category?: string | null;
          status?: ClientStatus;
          posts_per_month?: number;
          auto_publish_replies?: boolean;
          auto_publish_posts?: boolean;
          language?: string;
          brand_profile?: BrandProfile;
          assignee_member_id?: string | null;
          internal_notes?: string | null;
          last_synced_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          agency_id?: string;
          gbp_account_id?: string;
          gbp_location_id?: string;
          name?: string;
          address?: string | null;
          phone?: string | null;
          website?: string | null;
          primary_category?: string | null;
          status?: ClientStatus;
          posts_per_month?: number;
          auto_publish_replies?: boolean;
          auto_publish_posts?: boolean;
          language?: string;
          brand_profile?: BrandProfile;
          assignee_member_id?: string | null;
          internal_notes?: string | null;
          last_synced_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      client_month_coverage: {
        Row: {
          client_id: string;
          month: string;
          posts_target: number;
          posts_published: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          client_id: string;
          month: string;
          posts_target: number;
          posts_published?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          client_id?: string;
          month?: string;
          posts_target?: number;
          posts_published?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      reviews: {
        Row: {
          id: string;
          client_id: string;
          gbp_review_id: string;
          gbp_review_name: string;
          reviewer_name: string | null;
          reviewer_photo_url: string | null;
          star_rating: number;
          comment: string | null;
          review_created_at: string;
          review_updated_at: string | null;
          status: ReviewStatus;
          was_updated: boolean;
          synced_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          gbp_review_id: string;
          gbp_review_name: string;
          reviewer_name?: string | null;
          reviewer_photo_url?: string | null;
          star_rating: number;
          comment?: string | null;
          review_created_at: string;
          review_updated_at?: string | null;
          status?: ReviewStatus;
          was_updated?: boolean;
          synced_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          gbp_review_id?: string;
          gbp_review_name?: string;
          reviewer_name?: string | null;
          reviewer_photo_url?: string | null;
          star_rating?: number;
          comment?: string | null;
          review_created_at?: string;
          review_updated_at?: string | null;
          status?: ReviewStatus;
          was_updated?: boolean;
          synced_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reviews_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      review_replies: {
        Row: {
          id: string;
          review_id: string;
          draft_text: string;
          published_text: string | null;
          generated_by_ai: boolean;
          generation_count: number;
          approved_by: string | null;
          published_at: string | null;
          publish_error: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          review_id: string;
          draft_text: string;
          published_text?: string | null;
          generated_by_ai?: boolean;
          generation_count?: number;
          approved_by?: string | null;
          published_at?: string | null;
          publish_error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          review_id?: string;
          draft_text?: string;
          published_text?: string | null;
          generated_by_ai?: boolean;
          generation_count?: number;
          approved_by?: string | null;
          published_at?: string | null;
          publish_error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            // review_id est unique (upsert onConflict) : PostgREST embed
            // one-to-one — vérifié en runtime (objet, pas tableau).
            foreignKeyName: "review_replies_review_id_fkey";
            columns: ["review_id"];
            isOneToOne: true;
            referencedRelation: "reviews";
            referencedColumns: ["id"];
          },
        ];
      };
      posts: {
        Row: {
          id: string;
          client_id: string;
          type: PostType;
          summary: string;
          cta_type: CtaType | null;
          cta_url: string | null;
          image_path: string | null;
          image_prompt: string | null;
          angle: string | null;
          status: PostStatus;
          scheduled_for: string | null;
          published_at: string | null;
          gbp_post_name: string | null;
          publish_error: string | null;
          generated_by_ai: boolean;
          approved_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          type?: PostType;
          summary: string;
          cta_type?: CtaType | null;
          cta_url?: string | null;
          image_path?: string | null;
          image_prompt?: string | null;
          angle?: string | null;
          status?: PostStatus;
          scheduled_for?: string | null;
          published_at?: string | null;
          gbp_post_name?: string | null;
          publish_error?: string | null;
          generated_by_ai?: boolean;
          approved_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          type?: PostType;
          summary?: string;
          cta_type?: CtaType | null;
          cta_url?: string | null;
          image_path?: string | null;
          image_prompt?: string | null;
          angle?: string | null;
          status?: PostStatus;
          scheduled_for?: string | null;
          published_at?: string | null;
          gbp_post_name?: string | null;
          publish_error?: string | null;
          generated_by_ai?: boolean;
          approved_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      activity_log: {
        Row: {
          id: string;
          agency_id: string | null;
          client_id: string | null;
          actor: string;
          action: string;
          payload: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          agency_id?: string | null;
          client_id?: string | null;
          actor: string;
          action: string;
          payload?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          agency_id?: string | null;
          client_id?: string | null;
          actor?: string;
          action?: string;
          payload?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      client_board_state: {
        Row: {
          client_id: string;
          agency_id: string;
          name: string;
          status: ClientStatus;
          posts_per_month: number;
          unreplied_count: number;
          draft_reply_count: number;
          worst_pending_rating: number | null;
          oldest_pending_review_at: string | null;
          posts_published_this_month: number;
          posts_scheduled_this_month: number;
          draft_post_count: number;
          posts_due: number;
          next_scheduled_post: string | null;
          failed_post_count: number;
          assignee_member_id: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      user_agency_ids: {
        Args: Record<string, never>;
        Returns: string[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];

export type Agency = Tables<"agencies">;
export type AgencyMember = Tables<"agency_members">;
export type GoogleConnection = Tables<"google_connections">;
export type Client = Tables<"clients">;
export type Review = Tables<"reviews">;
export type ReviewReply = Tables<"review_replies">;
export type Post = Tables<"posts">;
export type ActivityLog = Tables<"activity_log">;
export type ClientBoardState =
  Database["public"]["Views"]["client_board_state"]["Row"];
