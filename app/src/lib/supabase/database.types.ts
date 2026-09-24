/**
 * Types for the schema in supabase/migrations.
 *
 * Hand-written rather than generated, because the project has no Supabase CLI
 * link yet. To regenerate once it does:
 *
 *   npx supabase gen types typescript --project-id <id> > src/lib/supabase/database.types.ts
 *
 * Note that the generator widens CHECK-constrained columns (`status`,
 * `maps_pref`, `role`) to `string`. The unions below are deliberate — narrow
 * them back after any regeneration.
 */

export type VisitStatus =
  | "on_the_way"
  | "in_progress"
  | "completed"
  | "cancelled";

export type MapsPref = "google" | "apple";

export type TechRole = "owner" | "tech";

export type Database = {
  public: {
    Tables: {
      companies: {
        Row: {
          id: string;
          created_at: string;
          business_name: string;
          timezone: string;
          alert_email: string;
          maps_pref: MapsPref;
        };
        Insert: {
          id?: string;
          created_at?: string;
          business_name: string;
          timezone?: string;
          alert_email: string;
          maps_pref?: MapsPref;
        };
        Update: {
          business_name?: string;
          timezone?: string;
          alert_email?: string;
          maps_pref?: MapsPref;
        };
        Relationships: [];
      };
      techs: {
        Row: {
          id: string;
          created_at: string;
          company_id: string;
          display_name: string;
          email: string;
          phone: string | null;
          role: TechRole;
        };
        Insert: {
          id: string;
          created_at?: string;
          company_id: string;
          display_name: string;
          email: string;
          phone?: string | null;
          role?: TechRole;
        };
        Update: {
          display_name?: string;
          email?: string;
          phone?: string | null;
        };
        Relationships: [
        {
          foreignKeyName: "techs_company_id_fkey";
          columns: ["company_id"];
          isOneToOne: false;
          referencedRelation: "companies";
          referencedColumns: ["id"];
        },
        ];
      };
      default_checklist_items: {
        Row: {
          id: string;
          created_at: string;
          company_id: string;
          label: string;
          position: number;
        };
        Insert: {
          id?: string;
          created_at?: string;
          company_id: string;
          label: string;
          position?: number;
        };
        Update: {
          label?: string;
          position?: number;
        };
        Relationships: [
        {
          foreignKeyName: "default_checklist_items_company_id_fkey";
          columns: ["company_id"];
          isOneToOne: false;
          referencedRelation: "companies";
          referencedColumns: ["id"];
        },
        ];
      };
      customers: {
        Row: {
          id: string;
          created_at: string;
          company_id: string;
          assigned_tech_id: string | null;
          first_name: string;
          last_name: string | null;
          email: string;
          address: string;
          est_duration_minutes: number;
          start_email_enabled: boolean;
          internal_notes: string | null;
          archived: boolean;
        };
        Insert: {
          id?: string;
          created_at?: string;
          company_id: string;
          assigned_tech_id?: string | null;
          first_name: string;
          last_name?: string | null;
          email: string;
          address: string;
          est_duration_minutes?: number;
          start_email_enabled?: boolean;
          internal_notes?: string | null;
          archived?: boolean;
        };
        Update: {
          assigned_tech_id?: string | null;
          first_name?: string;
          last_name?: string | null;
          email?: string;
          address?: string;
          est_duration_minutes?: number;
          start_email_enabled?: boolean;
          internal_notes?: string | null;
          archived?: boolean;
        };
        Relationships: [
        {
          foreignKeyName: "customers_company_id_fkey";
          columns: ["company_id"];
          isOneToOne: false;
          referencedRelation: "companies";
          referencedColumns: ["id"];
        },
        {
          foreignKeyName: "customers_assigned_tech_id_fkey";
          columns: ["assigned_tech_id"];
          isOneToOne: false;
          referencedRelation: "techs";
          referencedColumns: ["id"];
        },
        ];
      };
      customer_checklist_items: {
        Row: {
          id: string;
          created_at: string;
          customer_id: string;
          label: string;
          position: number;
        };
        Insert: {
          id?: string;
          created_at?: string;
          customer_id: string;
          label: string;
          position?: number;
        };
        Update: {
          label?: string;
          position?: number;
        };
        Relationships: [
        {
          foreignKeyName: "customer_checklist_items_customer_id_fkey";
          columns: ["customer_id"];
          isOneToOne: false;
          referencedRelation: "customers";
          referencedColumns: ["id"];
        },
        ];
      };
      visits: {
        Row: {
          id: string;
          created_at: string;
          customer_id: string;
          company_id: string;
          tech_id: string;
          status: VisitStatus;
          started_at: string;
          finished_at: string | null;
          tech_notes: string | null;
          chlorine_ppm: number | null;
          ph: number | null;
          alkalinity_ppm: number | null;
          public_token: string;
          feedback_closes_at: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          customer_id: string;
          company_id: string;
          tech_id: string;
          status?: VisitStatus;
          started_at?: string;
          finished_at?: string | null;
          tech_notes?: string | null;
          chlorine_ppm?: number | null;
          ph?: number | null;
          alkalinity_ppm?: number | null;
          /** Omit: defaults to a 43-char base64url token from the database. */
          public_token?: string;
          feedback_closes_at?: string | null;
        };
        Update: {
          status?: VisitStatus;
          finished_at?: string | null;
          tech_notes?: string | null;
          chlorine_ppm?: number | null;
          ph?: number | null;
          alkalinity_ppm?: number | null;
          feedback_closes_at?: string | null;
        };
        Relationships: [
        {
          foreignKeyName: "visits_customer_id_fkey";
          columns: ["customer_id"];
          isOneToOne: false;
          referencedRelation: "customers";
          referencedColumns: ["id"];
        },
        {
          foreignKeyName: "visits_company_id_fkey";
          columns: ["company_id"];
          isOneToOne: false;
          referencedRelation: "companies";
          referencedColumns: ["id"];
        },
        {
          foreignKeyName: "visits_tech_id_fkey";
          columns: ["tech_id"];
          isOneToOne: false;
          referencedRelation: "techs";
          referencedColumns: ["id"];
        },
        ];
      };
      visit_items: {
        Row: {
          id: string;
          created_at: string;
          visit_id: string;
          label: string;
          position: number;
          completed: boolean;
        };
        Insert: {
          id?: string;
          created_at?: string;
          visit_id: string;
          label: string;
          position?: number;
          completed?: boolean;
        };
        Update: {
          completed?: boolean;
          label?: string;
          position?: number;
        };
        Relationships: [
        {
          foreignKeyName: "visit_items_visit_id_fkey";
          columns: ["visit_id"];
          isOneToOne: false;
          referencedRelation: "visits";
          referencedColumns: ["id"];
        },
        ];
      };
      visit_photos: {
        Row: {
          id: string;
          created_at: string;
          visit_id: string;
          storage_path: string;
          position: number;
        };
        Insert: {
          id?: string;
          created_at?: string;
          visit_id: string;
          storage_path: string;
          position?: number;
        };
        Update: {
          position?: number;
        };
        Relationships: [
        {
          foreignKeyName: "visit_photos_visit_id_fkey";
          columns: ["visit_id"];
          isOneToOne: false;
          referencedRelation: "visits";
          referencedColumns: ["id"];
        },
        ];
      };
      feedback: {
        Row: {
          id: string;
          created_at: string;
          visit_id: string;
          rating: number | null;
          review: string | null;
          next_visit_notes: string | null;
          is_urgent: boolean;
          read_by_tech_at: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          visit_id: string;
          rating?: number | null;
          review?: string | null;
          next_visit_notes?: string | null;
          is_urgent?: boolean;
          read_by_tech_at?: string | null;
        };
        Update: {
          read_by_tech_at?: string | null;
        };
        Relationships: [
        {
          foreignKeyName: "feedback_visit_id_fkey";
          columns: ["visit_id"];
          isOneToOne: false;
          referencedRelation: "visits";
          referencedColumns: ["id"];
        },
        ];
      };
    };
    Views: Record<never, never>;
    Functions: {
      current_company_id: {
        Args: Record<string, never>;
        Returns: string;
      };
      bootstrap_company: {
        Args: {
          p_business_name: string;
          p_display_name: string;
          p_timezone?: string;
        };
        Returns: string;
      };
      generate_public_token: {
        Args: Record<string, never>;
        Returns: string;
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};

/** Convenience aliases so feature code does not spell out the deep path. */
type PublicTables = Database["public"]["Tables"];

export type Company = PublicTables["companies"]["Row"];
export type Tech = PublicTables["techs"]["Row"];
export type DefaultChecklistItem = PublicTables["default_checklist_items"]["Row"];
export type Customer = PublicTables["customers"]["Row"];
export type CustomerChecklistItem = PublicTables["customer_checklist_items"]["Row"];
export type Visit = PublicTables["visits"]["Row"];
export type VisitItem = PublicTables["visit_items"]["Row"];
export type VisitPhoto = PublicTables["visit_photos"]["Row"];
export type Feedback = PublicTables["feedback"]["Row"];
