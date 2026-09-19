export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          user_id: string;
          created_at: string;
          consent_version: string | null;
          consented_at: string | null;
          age_confirmed_at: string | null;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          consent_version?: string | null;
          consented_at?: string | null;
          age_confirmed_at?: string | null;
        };
        Update: {
          consent_version?: string | null;
          consented_at?: string | null;
          age_confirmed_at?: string | null;
        };
        Relationships: [];
      };
      contribution_receipts: {
        Row: {
          id: string;
          user_id: string;
          public_task_id: string | null;
          status: string;
          credits_awarded: number;
          submitted_at: string;
          resolved_at: string | null;
          reason_code: string | null;
        };
        Insert: {
          user_id: string;
          status: string;
          public_task_id?: string | null;
          credits_awarded?: number;
        };
        Update: {
          status?: string;
          credits_awarded?: number;
          resolved_at?: string | null;
          reason_code?: string | null;
        };
        Relationships: [];
      };
      reward_ledger: {
        Row: {
          id: string;
          user_id: string;
          source_type: string;
          source_id: string;
          credits: number;
          minutes: number;
          created_at: string;
        };
        Insert: {
          user_id: string;
          source_type: string;
          source_id: string;
          credits: number;
          minutes: number;
        };
        Update: never;
        Relationships: [];
      };
      earned_entitlements: {
        Row: {
          user_id: string;
          earned_ad_free_until: string | null;
          lifetime_credits: number;
          version: number;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          earned_ad_free_until?: string | null;
          lifetime_credits?: number;
        };
        Update: {
          earned_ad_free_until?: string | null;
          lifetime_credits?: number;
          version?: number;
        };
        Relationships: [];
      };
      app_config: {
        Row: {
          id: number;
          version: number;
          contributions_enabled: boolean;
          rewards_enabled: boolean;
          network_ads_enabled: boolean;
          rewarded_ads_enabled: boolean;
          paywall_enabled: boolean;
          learn_enabled: boolean;
          updated_at: string;
        };
        Insert: {
          version: number;
        };
        Update: {
          contributions_enabled?: boolean;
          rewards_enabled?: boolean;
          network_ads_enabled?: boolean;
          rewarded_ads_enabled?: boolean;
          paywall_enabled?: boolean;
          learn_enabled?: boolean;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      service_lease_contribution_task: {
        Args: { p_user_id: string };
        Returns: Json;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

/**
 * Checked-in shape matching supabase/migrations/20260919180000_beta_schema.sql.
 * Regenerate when Docker is available:
 *   bash supabase/scripts/gen-types.sh
 */
