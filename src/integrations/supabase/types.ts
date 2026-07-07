export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          billing_cycle: string
          created_at: string
          extraction_count_month: number
          extraction_reset_at: string
          id: string
          name: string
          plan: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
        }
        Insert: {
          billing_cycle?: string
          created_at?: string
          extraction_count_month?: number
          extraction_reset_at?: string
          id?: string
          name?: string
          plan?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
        }
        Update: {
          billing_cycle?: string
          created_at?: string
          extraction_count_month?: number
          extraction_reset_at?: string
          id?: string
          name?: string
          plan?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
        }
        Relationships: []
      }
      email_campaigns: {
        Row: {
          account_id: string
          body: string | null
          created_at: string
          id: string
          recipient_lead_ids: string[]
          scheduled_at: string | null
          sent_at: string | null
          status: string
          subject: string | null
          template_id: string | null
        }
        Insert: {
          account_id: string
          body?: string | null
          created_at?: string
          id?: string
          recipient_lead_ids?: string[]
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          template_id?: string | null
        }
        Update: {
          account_id?: string
          body?: string | null
          created_at?: string
          id?: string
          recipient_lead_ids?: string[]
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_campaigns_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_campaigns_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          account_id: string
          body: string | null
          created_at: string
          id: string
          name: string
          subject: string | null
        }
        Insert: {
          account_id: string
          body?: string | null
          created_at?: string
          id?: string
          name: string
          subject?: string | null
        }
        Update: {
          account_id?: string
          body?: string | null
          created_at?: string
          id?: string
          name?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          account_id: string
          created_at: string
          credentials_encrypted: string | null
          id: string
          provider: string
          status: string
          webhook_url: string | null
        }
        Insert: {
          account_id: string
          created_at?: string
          credentials_encrypted?: string | null
          id?: string
          provider: string
          status?: string
          webhook_url?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string
          credentials_encrypted?: string | null
          id?: string
          provider?: string
          status?: string
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integrations_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_events: {
        Row: {
          account_id: string | null
          created_at: string
          id: string
          lead_id: string
          payload: Json | null
          type: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          id?: string
          lead_id: string
          payload?: Json | null
          type: string
        }
        Update: {
          account_id?: string | null
          created_at?: string
          id?: string
          lead_id?: string
          payload?: Json | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_events_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_notes: {
        Row: {
          body: string
          created_at: string
          id: string
          lead_id: string
          user_id: string | null
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          lead_id: string
          user_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          lead_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_tags: {
        Row: {
          id: string
          lead_id: string
          tag: string
        }
        Insert: {
          id?: string
          lead_id: string
          tag: string
        }
        Update: {
          id?: string
          lead_id?: string
          tag?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_tags_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          account_id: string | null
          address: string | null
          company_name: string
          contact_name: string | null
          created_at: string | null
          deal_value: number | null
          email: string | null
          extraction_date: string | null
          id: string
          industry: string | null
          kanban_order: number | null
          last_exported_at: string | null
          last_interaction_at: string | null
          location: string | null
          niche_quality: number
          notes: string | null
          opening_date: string | null
          phone: string | null
          rating: number | null
          score: number | null
          source: string | null
          stage: Database["public"]["Enums"]["pipeline_stage"] | null
          status: string | null
          tags: string[] | null
          type: string | null
          user_id: string
          user_ratings_total: number | null
          website: string | null
        }
        Insert: {
          account_id?: string | null
          address?: string | null
          company_name: string
          contact_name?: string | null
          created_at?: string | null
          deal_value?: number | null
          email?: string | null
          extraction_date?: string | null
          id?: string
          industry?: string | null
          kanban_order?: number | null
          last_exported_at?: string | null
          last_interaction_at?: string | null
          location?: string | null
          niche_quality?: number
          notes?: string | null
          opening_date?: string | null
          phone?: string | null
          rating?: number | null
          score?: number | null
          source?: string | null
          stage?: Database["public"]["Enums"]["pipeline_stage"] | null
          status?: string | null
          tags?: string[] | null
          type?: string | null
          user_id: string
          user_ratings_total?: number | null
          website?: string | null
        }
        Update: {
          account_id?: string | null
          address?: string | null
          company_name?: string
          contact_name?: string | null
          created_at?: string | null
          deal_value?: number | null
          email?: string | null
          extraction_date?: string | null
          id?: string
          industry?: string | null
          kanban_order?: number | null
          last_exported_at?: string | null
          last_interaction_at?: string | null
          location?: string | null
          niche_quality?: number
          notes?: string | null
          opening_date?: string | null
          phone?: string | null
          rating?: number | null
          score?: number | null
          source?: string | null
          stage?: Database["public"]["Enums"]["pipeline_stage"] | null
          status?: string | null
          tags?: string[] | null
          type?: string | null
          user_id?: string
          user_ratings_total?: number | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_path: string | null
          action_tab: string | null
          action_type: string | null
          created_at: string | null
          id: string
          message: string
          read: boolean | null
          type: string | null
          user_id: string
        }
        Insert: {
          action_path?: string | null
          action_tab?: string | null
          action_type?: string | null
          created_at?: string | null
          id?: string
          message: string
          read?: boolean | null
          type?: string | null
          user_id: string
        }
        Update: {
          action_path?: string | null
          action_tab?: string | null
          action_type?: string | null
          created_at?: string | null
          id?: string
          message?: string
          read?: boolean | null
          type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_id: string | null
          account_role: string
          avatar_url: string | null
          bio: string | null
          company_name: string | null
          crm_type: string | null
          email: string | null
          extracted_leads_count: number | null
          full_name: string | null
          id: string
          industry: string | null
          location: string | null
          onboarded_at: string | null
          phone: string | null
          subscription_type: string | null
          trial_start_date: string | null
          trial_status: string | null
          updated_at: string | null
          webhook_url: string | null
          website: string | null
        }
        Insert: {
          account_id?: string | null
          account_role?: string
          avatar_url?: string | null
          bio?: string | null
          company_name?: string | null
          crm_type?: string | null
          email?: string | null
          extracted_leads_count?: number | null
          full_name?: string | null
          id: string
          industry?: string | null
          location?: string | null
          onboarded_at?: string | null
          phone?: string | null
          subscription_type?: string | null
          trial_start_date?: string | null
          trial_status?: string | null
          updated_at?: string | null
          webhook_url?: string | null
          website?: string | null
        }
        Update: {
          account_id?: string | null
          account_role?: string
          avatar_url?: string | null
          bio?: string | null
          company_name?: string | null
          crm_type?: string | null
          email?: string | null
          extracted_leads_count?: number | null
          full_name?: string | null
          id?: string
          industry?: string | null
          location?: string | null
          onboarded_at?: string | null
          phone?: string | null
          subscription_type?: string | null
          trial_start_date?: string | null
          trial_status?: string | null
          updated_at?: string | null
          webhook_url?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      searches: {
        Row: {
          account_id: string
          count: number
          created_at: string
          id: string
          location: string | null
          query: string
          source: string | null
        }
        Insert: {
          account_id: string
          count?: number
          created_at?: string
          id?: string
          location?: string | null
          query: string
          source?: string | null
        }
        Update: {
          account_id?: string
          count?: number
          created_at?: string
          id?: string
          location?: string | null
          query?: string
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "searches_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["user_role"] | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"] | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"] | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_account_id: { Args: never; Returns: string }
      is_valid_trial: { Args: { user_profile_id: string }; Returns: boolean }
      lead_score: {
        Args: {
          p_address: string
          p_email: string
          p_niche_quality: number
          p_phone: string
          p_website: string
        }
        Returns: number
      }
    }
    Enums: {
      pipeline_stage:
        | "novo"
        | "primeiro_contato"
        | "qualificacao"
        | "proposta"
        | "negociacao"
        | "fechado_ganho"
        | "fechado_perdido"
      user_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      pipeline_stage: [
        "novo",
        "primeiro_contato",
        "qualificacao",
        "proposta",
        "negociacao",
        "fechado_ganho",
        "fechado_perdido",
      ],
      user_role: ["admin", "user"],
    },
  },
} as const
