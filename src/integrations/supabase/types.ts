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
      design_references: {
        Row: {
          created_at: string
          id: string
          lead_id: string
          name: string
          reason: string | null
          url: string | null
          used: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lead_id: string
          name: string
          reason?: string | null
          url?: string | null
          used?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lead_id?: string
          name?: string
          reason?: string | null
          url?: string | null
          used?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "design_references_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string
          id: string
          kind: string
          lead_id: string | null
          occurred_on: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          description: string
          id?: string
          kind?: string
          lead_id?: string | null
          occurred_on?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          id?: string
          kind?: string
          lead_id?: string | null
          occurred_on?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_audits: {
        Row: {
          created_at: string
          google_findings: Json
          id: string
          lead_id: string
          problems: Json
          social_findings: Json
          sources: Json
          summary: string | null
          user_id: string
          website_findings: Json
        }
        Insert: {
          created_at?: string
          google_findings?: Json
          id?: string
          lead_id: string
          problems?: Json
          social_findings?: Json
          sources?: Json
          summary?: string | null
          user_id: string
          website_findings?: Json
        }
        Update: {
          created_at?: string
          google_findings?: Json
          id?: string
          lead_id?: string
          problems?: Json
          social_findings?: Json
          sources?: Json
          summary?: string | null
          user_id?: string
          website_findings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "lead_audits_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_opportunities: {
        Row: {
          benefits: Json
          created_at: string
          cta: string | null
          id: string
          lead_id: string
          opportunity_summary: string | null
          price_max: number | null
          price_min: number | null
          rationale: string | null
          sales_argument: string | null
          service_name: string | null
          structure: Json
          urgency: string | null
          user_id: string
          website_prompt: string | null
        }
        Insert: {
          benefits?: Json
          created_at?: string
          cta?: string | null
          id?: string
          lead_id: string
          opportunity_summary?: string | null
          price_max?: number | null
          price_min?: number | null
          rationale?: string | null
          sales_argument?: string | null
          service_name?: string | null
          structure?: Json
          urgency?: string | null
          user_id: string
          website_prompt?: string | null
        }
        Update: {
          benefits?: Json
          created_at?: string
          cta?: string | null
          id?: string
          lead_id?: string
          opportunity_summary?: string | null
          price_max?: number | null
          price_min?: number | null
          rationale?: string | null
          sales_argument?: string | null
          service_name?: string | null
          structure?: Json
          urgency?: string | null
          user_id?: string
          website_prompt?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_opportunities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_score_feedback: {
        Row: {
          converted: boolean
          created_at: string
          deal_value: number | null
          id: string
          lead_id: string | null
          reason: string | null
          score_before: number | null
          user_id: string
        }
        Insert: {
          converted?: boolean
          created_at?: string
          deal_value?: number | null
          id?: string
          lead_id?: string | null
          reason?: string | null
          score_before?: number | null
          user_id: string
        }
        Update: {
          converted?: boolean
          created_at?: string
          deal_value?: number | null
          id?: string
          lead_id?: string | null
          reason?: string | null
          score_before?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_score_feedback_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          address: string | null
          category: string | null
          city: string | null
          company_name: string
          country: string | null
          created_at: string
          description: string | null
          digital_presence_score: number
          email: string | null
          facebook: string | null
          followers: number | null
          google_maps_url: string | null
          id: string
          instagram: string | null
          investment_score: number
          is_demo: boolean
          lead_score: number
          main_problem: string | null
          next_contact_at: string | null
          notes: string | null
          phone: string | null
          potential_value_max: number | null
          potential_value_min: number | null
          problem_score: number
          rating: number | null
          recommended_offer: string | null
          review_count: number | null
          sales_potential_score: number
          source: string
          state: string | null
          status: string
          tags: string[]
          updated_at: string
          user_id: string
          website: string | null
          website_need_score: number
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          category?: string | null
          city?: string | null
          company_name: string
          country?: string | null
          created_at?: string
          description?: string | null
          digital_presence_score?: number
          email?: string | null
          facebook?: string | null
          followers?: number | null
          google_maps_url?: string | null
          id?: string
          instagram?: string | null
          investment_score?: number
          is_demo?: boolean
          lead_score?: number
          main_problem?: string | null
          next_contact_at?: string | null
          notes?: string | null
          phone?: string | null
          potential_value_max?: number | null
          potential_value_min?: number | null
          problem_score?: number
          rating?: number | null
          recommended_offer?: string | null
          review_count?: number | null
          sales_potential_score?: number
          source?: string
          state?: string | null
          status?: string
          tags?: string[]
          updated_at?: string
          user_id: string
          website?: string | null
          website_need_score?: number
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          category?: string | null
          city?: string | null
          company_name?: string
          country?: string | null
          created_at?: string
          description?: string | null
          digital_presence_score?: number
          email?: string | null
          facebook?: string | null
          followers?: number | null
          google_maps_url?: string | null
          id?: string
          instagram?: string | null
          investment_score?: number
          is_demo?: boolean
          lead_score?: number
          main_problem?: string | null
          next_contact_at?: string | null
          notes?: string | null
          phone?: string | null
          potential_value_max?: number | null
          potential_value_min?: number | null
          problem_score?: number
          rating?: number | null
          recommended_offer?: string | null
          review_count?: number | null
          sales_potential_score?: number
          source?: string
          state?: string | null
          status?: string
          tags?: string[]
          updated_at?: string
          user_id?: string
          website?: string | null
          website_need_score?: number
          whatsapp?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      outreach_messages: {
        Row: {
          channel: string
          content: string
          created_at: string
          id: string
          lead_id: string
          sent: boolean
          sent_at: string | null
          step: string
          user_id: string
        }
        Insert: {
          channel?: string
          content: string
          created_at?: string
          id?: string
          lead_id: string
          sent?: boolean
          sent_at?: string | null
          step?: string
          user_id: string
        }
        Update: {
          channel?: string
          content?: string
          created_at?: string
          id?: string
          lead_id?: string
          sent?: boolean
          sent_at?: string | null
          step?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outreach_messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company_name: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          instagram: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          company_name?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          instagram?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          company_name?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          instagram?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      proposals: {
        Row: {
          client_name: string
          conditions: string | null
          created_at: string
          delivery_days: number | null
          description: string | null
          id: string
          lead_id: string | null
          notes: string | null
          price: number
          scope: Json
          service_name: string | null
          status: string
          updated_at: string
          user_id: string
          valid_until: string | null
        }
        Insert: {
          client_name: string
          conditions?: string | null
          created_at?: string
          delivery_days?: number | null
          description?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          price?: number
          scope?: Json
          service_name?: string | null
          status?: string
          updated_at?: string
          user_id: string
          valid_until?: string | null
        }
        Update: {
          client_name?: string
          conditions?: string | null
          created_at?: string
          delivery_days?: number | null
          description?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          price?: number
          scope?: Json
          service_name?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          active: boolean
          created_at: string
          delivery_days: number | null
          description: string | null
          id: string
          name: string
          price_max: number
          price_min: number
          priority: number
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          delivery_days?: number | null
          description?: string | null
          id?: string
          name: string
          price_max?: number
          price_min?: number
          priority?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          delivery_days?: number | null
          description?: string | null
          id?: string
          name?: string
          price_max?: number
          price_min?: number
          priority?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          avg_ticket: number
          close_rate: number
          created_at: string
          eur_brl: number
          id: string
          malta_goal_eur: number
          message_tone: string
          priority_cities: string[]
          priority_segments: string[]
          ticket_max: number
          ticket_min: number
          updated_at: string
          user_id: string
        }
        Insert: {
          avg_ticket?: number
          close_rate?: number
          created_at?: string
          eur_brl?: number
          id?: string
          malta_goal_eur?: number
          message_tone?: string
          priority_cities?: string[]
          priority_segments?: string[]
          ticket_max?: number
          ticket_min?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          avg_ticket?: number
          close_rate?: number
          created_at?: string
          eur_brl?: number
          id?: string
          malta_goal_eur?: number
          message_tone?: string
          priority_cities?: string[]
          priority_segments?: string[]
          ticket_max?: number
          ticket_min?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
