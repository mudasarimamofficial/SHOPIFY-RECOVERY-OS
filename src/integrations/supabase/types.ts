export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      activity_log: {
        Row: {
          created_at: string;
          detail: string | null;
          id: string;
          kind: string;
          meta: Json | null;
          store_id: string | null;
          title: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          detail?: string | null;
          id?: string;
          kind: string;
          meta?: Json | null;
          store_id?: string | null;
          title: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          detail?: string | null;
          id?: string;
          kind?: string;
          meta?: Json | null;
          store_id?: string | null;
          title?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "activity_log_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      backup_resources: {
        Row: {
          backup_id: string;
          bytes: number;
          count: number;
          created_at: string;
          error: string | null;
          id: string;
          recoverability: string;
          resource_type: string;
          status: string;
          user_id: string;
        };
        Insert: {
          backup_id: string;
          bytes?: number;
          count?: number;
          created_at?: string;
          error?: string | null;
          id?: string;
          recoverability?: string;
          resource_type: string;
          status?: string;
          user_id: string;
        };
        Update: {
          backup_id?: string;
          bytes?: number;
          count?: number;
          created_at?: string;
          error?: string | null;
          id?: string;
          recoverability?: string;
          resource_type?: string;
          status?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "backup_resources_backup_id_fkey";
            columns: ["backup_id"];
            isOneToOne: false;
            referencedRelation: "backups";
            referencedColumns: ["id"];
          },
        ];
      };
      backups: {
        Row: {
          completed_at: string | null;
          created_at: string;
          current_stage: string | null;
          errors_count: number;
          id: string;
          label: string | null;
          manifest: Json | null;
          package_data: Json | null;
          progress: number;
          recovery_score: number | null;
          resources_completed: number;
          resources_total: number;
          size_bytes: number | null;
          started_at: string;
          status: string;
          store_id: string;
          user_id: string;
          warnings_count: number;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          current_stage?: string | null;
          errors_count?: number;
          id?: string;
          label?: string | null;
          manifest?: Json | null;
          package_data?: Json | null;
          progress?: number;
          recovery_score?: number | null;
          resources_completed?: number;
          resources_total?: number;
          size_bytes?: number | null;
          started_at?: string;
          status?: string;
          store_id: string;
          user_id: string;
          warnings_count?: number;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          current_stage?: string | null;
          errors_count?: number;
          id?: string;
          label?: string | null;
          manifest?: Json | null;
          package_data?: Json | null;
          progress?: number;
          recovery_score?: number | null;
          resources_completed?: number;
          resources_total?: number;
          size_bytes?: number | null;
          started_at?: string;
          status?: string;
          store_id?: string;
          user_id?: string;
          warnings_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: "backups_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      restore_jobs: {
        Row: {
          backup_id: string;
          completed_at: string | null;
          created_at: string;
          id: string;
          plan: Json | null;
          progress: number;
          report: Json | null;
          started_at: string;
          status: string;
          target_store_id: string | null;
          user_id: string;
        };
        Insert: {
          backup_id: string;
          completed_at?: string | null;
          created_at?: string;
          id?: string;
          plan?: Json | null;
          progress?: number;
          report?: Json | null;
          started_at?: string;
          status?: string;
          target_store_id?: string | null;
          user_id: string;
        };
        Update: {
          backup_id?: string;
          completed_at?: string | null;
          created_at?: string;
          id?: string;
          plan?: Json | null;
          progress?: number;
          report?: Json | null;
          started_at?: string;
          status?: string;
          target_store_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "restore_jobs_backup_id_fkey";
            columns: ["backup_id"];
            isOneToOne: false;
            referencedRelation: "backups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "restore_jobs_target_store_id_fkey";
            columns: ["target_store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      stores: {
        Row: {
          access_token_ciphertext: string;
          api_version: string | null;
          country: string | null;
          created_at: string;
          currency: string | null;
          email: string | null;
          id: string;
          last_synced_at: string | null;
          name: string | null;
          plan: string | null;
          scopes: string[] | null;
          shop_domain: string;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          access_token_ciphertext: string;
          api_version?: string | null;
          country?: string | null;
          created_at?: string;
          currency?: string | null;
          email?: string | null;
          id?: string;
          last_synced_at?: string | null;
          name?: string | null;
          plan?: string | null;
          scopes?: string[] | null;
          shop_domain: string;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          access_token_ciphertext?: string;
          api_version?: string | null;
          country?: string | null;
          created_at?: string;
          currency?: string | null;
          email?: string | null;
          id?: string;
          last_synced_at?: string | null;
          name?: string | null;
          plan?: string | null;
          scopes?: string[] | null;
          shop_domain?: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
