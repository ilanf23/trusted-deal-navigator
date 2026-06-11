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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      active_calls: {
        Row: {
          answered_at: string | null
          call_flow_id: string | null
          call_sid: string
          created_at: string
          direction: string
          ended_at: string | null
          related_type: Database["public"]["Enums"]["related_type_enum"] | null
          from_number: string
          frontend_ack_at: string | null
          id: string
          lead_id: string | null
          status: string
          to_number: string
          updated_at: string
          user_id: string | null
          webhook_timestamp: string | null
        }
        Insert: {
          answered_at?: string | null
          call_flow_id?: string | null
          call_sid: string
          created_at?: string
          direction?: string
          ended_at?: string | null
          related_type?: Database["public"]["Enums"]["related_type_enum"] | null
          from_number: string
          frontend_ack_at?: string | null
          id?: string
          lead_id?: string | null
          status?: string
          to_number: string
          updated_at?: string
          user_id?: string | null
          webhook_timestamp?: string | null
        }
        Update: {
          answered_at?: string | null
          call_flow_id?: string | null
          call_sid?: string
          created_at?: string
          direction?: string
          ended_at?: string | null
          related_type?: Database["public"]["Enums"]["related_type_enum"] | null
          from_number?: string
          frontend_ack_at?: string | null
          id?: string
          lead_id?: string | null
          status?: string
          to_number?: string
          updated_at?: string
          user_id?: string | null
          webhook_timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "active_calls_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      activities: {
        Row: {
          activity_type: string
          content: string | null
          copper_activity_id: string | null
          created_at: string
          created_by: string | null
          related_id: string
          related_type: Database["public"]["Enums"]["related_type_enum"] | null
          id: string
          source_system: string
          title: string | null
        }
        Insert: {
          activity_type: string
          content?: string | null
          copper_activity_id?: string | null
          created_at?: string
          created_by?: string | null
          related_id: string
          related_type?: Database["public"]["Enums"]["related_type_enum"] | null
          id?: string
          source_system?: string
          title?: string | null
        }
        Update: {
          activity_type?: string
          content?: string | null
          copper_activity_id?: string | null
          created_at?: string
          created_by?: string | null
          related_id?: string
          related_type?: Database["public"]["Enums"]["related_type_enum"] | null
          id?: string
          source_system?: string
          title?: string | null
        }
        Relationships: []
      }
      activity_comments: {
        Row: {
          activity_id: string
          content: string
          created_at: string
          created_by: string | null
          related_type: Database["public"]["Enums"]["related_type_enum"] | null
          id: string
          lead_id: string
        }
        Insert: {
          activity_id: string
          content: string
          created_at?: string
          created_by?: string | null
          related_type?: Database["public"]["Enums"]["related_type_enum"] | null
          id?: string
          lead_id: string
        }
        Update: {
          activity_id?: string
          content?: string
          created_at?: string
          created_by?: string | null
          related_type?: Database["public"]["Enums"]["related_type_enum"] | null
          id?: string
          lead_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_comments_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_events: {
        Row: {
          created_at: string
          event_type: Database["public"]["Enums"]["ai_event_type"]
          id: string
          parent_id: string | null
          payload: Json
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: Database["public"]["Enums"]["ai_event_type"]
          id?: string
          parent_id?: string | null
          payload?: Json
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: Database["public"]["Enums"]["ai_event_type"]
          id?: string
          parent_id?: string | null
          payload?: Json
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_events_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "ai_events"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          appointment_type: string | null
          created_at: string
          description: string | null
          end_time: string | null
          related_type: Database["public"]["Enums"]["related_type_enum"] | null
          google_calendar_id: string | null
          google_event_id: string | null
          id: string
          lead_id: string | null
          start_time: string
          sync_status: string | null
          synced_at: string | null
          title: string
          updated_at: string
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          appointment_type?: string | null
          created_at?: string
          description?: string | null
          end_time?: string | null
          related_type?: Database["public"]["Enums"]["related_type_enum"] | null
          google_calendar_id?: string | null
          google_event_id?: string | null
          id?: string
          lead_id?: string | null
          start_time: string
          sync_status?: string | null
          synced_at?: string | null
          title: string
          updated_at?: string
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          appointment_type?: string | null
          created_at?: string
          description?: string | null
          end_time?: string | null
          related_type?: Database["public"]["Enums"]["related_type_enum"] | null
          google_calendar_id?: string | null
          google_event_id?: string | null
          id?: string
          lead_id?: string | null
          start_time?: string
          sync_status?: string | null
          synced_at?: string | null
          title?: string
          updated_at?: string
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      bug_reports: {
        Row: {
          assigned_to_id: string | null
          browser_info: string | null
          created_at: string
          description: string | null
          id: string
          page_url: string | null
          priority: string | null
          resolved_at: string | null
          screenshot_url: string | null
          solution: string | null
          status: string | null
          submitted_by: string | null
          submitted_by_email: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to_id?: string | null
          browser_info?: string | null
          created_at?: string
          description?: string | null
          id?: string
          page_url?: string | null
          priority?: string | null
          resolved_at?: string | null
          screenshot_url?: string | null
          solution?: string | null
          status?: string | null
          submitted_by?: string | null
          submitted_by_email?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to_id?: string | null
          browser_info?: string | null
          created_at?: string
          description?: string | null
          id?: string
          page_url?: string | null
          priority?: string | null
          resolved_at?: string | null
          screenshot_url?: string | null
          solution?: string | null
          status?: string | null
          submitted_by?: string | null
          submitted_by_email?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bug_reports_assigned_to_id_fkey"
            columns: ["assigned_to_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      call_events: {
        Row: {
          call_flow_id: string
          call_sid: string
          created_at: string
          db_inserted: boolean | null
          device_ready: boolean | null
          related_type: Database["public"]["Enums"]["related_type_enum"] | null
          event_type: string
          from_number: string | null
          frontend_acknowledged_at: string | null
          frontend_received: boolean | null
          id: string
          lead_id: string | null
          lead_name: string | null
          metadata: Json | null
          realtime_sent: boolean | null
          socket_connected: boolean | null
          to_number: string | null
          user_session_active: boolean | null
          webhook_received: boolean | null
        }
        Insert: {
          call_flow_id?: string
          call_sid: string
          created_at?: string
          db_inserted?: boolean | null
          device_ready?: boolean | null
          related_type?: Database["public"]["Enums"]["related_type_enum"] | null
          event_type: string
          from_number?: string | null
          frontend_acknowledged_at?: string | null
          frontend_received?: boolean | null
          id?: string
          lead_id?: string | null
          lead_name?: string | null
          metadata?: Json | null
          realtime_sent?: boolean | null
          socket_connected?: boolean | null
          to_number?: string | null
          user_session_active?: boolean | null
          webhook_received?: boolean | null
        }
        Update: {
          call_flow_id?: string
          call_sid?: string
          created_at?: string
          db_inserted?: boolean | null
          device_ready?: boolean | null
          related_type?: Database["public"]["Enums"]["related_type_enum"] | null
          event_type?: string
          from_number?: string | null
          frontend_acknowledged_at?: string | null
          frontend_received?: boolean | null
          id?: string
          lead_id?: string | null
          lead_name?: string | null
          metadata?: Json | null
          realtime_sent?: boolean | null
          socket_connected?: boolean | null
          to_number?: string | null
          user_session_active?: boolean | null
          webhook_received?: boolean | null
        }
        Relationships: []
      }
      communications: {
        Row: {
          call_sid: string | null
          communication_type: string
          content: string | null
          created_at: string
          direction: string
          duration_seconds: number | null
          related_type: Database["public"]["Enums"]["related_type_enum"] | null
          id: string
          lead_id: string | null
          phone_number: string | null
          recording_sid: string | null
          recording_status: string | null
          recording_url: string | null
          status: string | null
          transcript: string | null
          transcription_attempts: number
          transcription_error: string | null
          transcription_status: string | null
          transcription_updated_at: string | null
          user_id: string | null
        }
        Insert: {
          call_sid?: string | null
          communication_type: string
          content?: string | null
          created_at?: string
          direction: string
          duration_seconds?: number | null
          related_type?: Database["public"]["Enums"]["related_type_enum"] | null
          id?: string
          lead_id?: string | null
          phone_number?: string | null
          recording_sid?: string | null
          recording_status?: string | null
          recording_url?: string | null
          status?: string | null
          transcript?: string | null
          transcription_attempts?: number
          transcription_error?: string | null
          transcription_status?: string | null
          transcription_updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          call_sid?: string | null
          communication_type?: string
          content?: string | null
          created_at?: string
          direction?: string
          duration_seconds?: number | null
          related_type?: Database["public"]["Enums"]["related_type_enum"] | null
          id?: string
          lead_id?: string | null
          phone_number?: string | null
          recording_sid?: string | null
          recording_status?: string | null
          recording_url?: string | null
          status?: string | null
          transcript?: string | null
          transcription_attempts?: number
          transcription_error?: string | null
          transcription_status?: string | null
          transcription_updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          about: string | null
          assigned_to: string | null
          company_name: string
          contact_type: string | null
          copper_company_id: string | null
          created_at: string
          description: string | null
          related_id: string
          id: string
          last_activity_at: string | null
          notes: string | null
          source: string | null
          source_system: string
          tags: string[] | null
          updated_at: string
          website: string | null
          work_website: string | null
        }
        Insert: {
          about?: string | null
          assigned_to?: string | null
          company_name: string
          contact_type?: string | null
          copper_company_id?: string | null
          created_at?: string
          description?: string | null
          related_id: string
          id?: string
          last_activity_at?: string | null
          notes?: string | null
          source?: string | null
          source_system?: string
          tags?: string[] | null
          updated_at?: string
          website?: string | null
          work_website?: string | null
        }
        Update: {
          about?: string | null
          assigned_to?: string | null
          company_name?: string
          contact_type?: string | null
          copper_company_id?: string | null
          created_at?: string
          description?: string | null
          related_id?: string
          id?: string
          last_activity_at?: string | null
          notes?: string | null
          source?: string | null
          source_system?: string
          tags?: string[] | null
          updated_at?: string
          website?: string | null
          work_website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_related_id_fkey"
            columns: ["related_id"]
            isOneToOne: false
            referencedRelation: "related"
            referencedColumns: ["id"]
          },
        ]
      }
      company_people: {
        Row: {
          company_id: string
          created_at: string
          id: string
          person_id: string
          role: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          person_id: string
          role?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          person_id?: string
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_people_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_people_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          client_id: string
          created_at: string
          id: string
          last_message_at: string | null
          subject: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          subject?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          subject?: string | null
        }
        Relationships: []
      }
      dashboard_deals: {
        Row: {
          closed_at: string | null
          created_at: string
          days_in_stage: number
          deal_name: string | null
          id: string
          requested_amount: number
          stage: string
          user_id: string | null
          weighted_fees: number
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          days_in_stage?: number
          deal_name?: string | null
          id?: string
          requested_amount?: number
          stage: string
          user_id?: string | null
          weighted_fees?: number
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          days_in_stage?: number
          deal_name?: string | null
          id?: string
          requested_amount?: number
          stage?: string
          user_id?: string | null
          weighted_fees?: number
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_deals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_referral_sources: {
        Row: {
          created_at: string
          id: string
          last_contact_days_ago: number
          name: string
          status: string
          total_revenue: number
        }
        Insert: {
          created_at?: string
          id?: string
          last_contact_days_ago?: number
          name: string
          status?: string
          total_revenue?: number
        }
        Update: {
          created_at?: string
          id?: string
          last_contact_days_ago?: number
          name?: string
          status?: string
          total_revenue?: number
        }
        Relationships: []
      }
      dashboard_weekly_scorecard: {
        Row: {
          color_class: string | null
          created_at: string
          display_order: number
          id: string
          metric_label: string
          metric_value: string
        }
        Insert: {
          color_class?: string | null
          created_at?: string
          display_order?: number
          id?: string
          metric_label: string
          metric_value: string
        }
        Update: {
          color_class?: string | null
          created_at?: string
          display_order?: number
          id?: string
          metric_label?: string
          metric_value?: string
        }
        Relationships: []
      }
      deal_contacts: {
        Row: {
          created_at: string
          deal_id: string
          email: string | null
          related_id: string | null
          related_type: Database["public"]["Enums"]["related_type_enum"] | null
          id: string
          is_primary: boolean | null
          name: string
          notes: string | null
          phone: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deal_id: string
          email?: string | null
          related_id?: string | null
          related_type?: Database["public"]["Enums"]["related_type_enum"] | null
          id?: string
          is_primary?: boolean | null
          name: string
          notes?: string | null
          phone?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deal_id?: string
          email?: string | null
          related_id?: string | null
          related_type?: Database["public"]["Enums"]["related_type_enum"] | null
          id?: string
          is_primary?: boolean | null
          name?: string
          notes?: string | null
          phone?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_contacts_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_lender_programs: {
        Row: {
          created_at: string
          related_id: string
          related_type: Database["public"]["Enums"]["related_type_enum"] | null
          id: string
          notes: string | null
          program_id: string
          status: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          related_id: string
          related_type?: Database["public"]["Enums"]["related_type_enum"] | null
          id?: string
          notes?: string | null
          program_id: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          related_id?: string
          related_type?: Database["public"]["Enums"]["related_type_enum"] | null
          id?: string
          notes?: string | null
          program_id?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_lender_programs_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "lender_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_milestones: {
        Row: {
          completed: boolean
          completed_at: string | null
          completed_by: string | null
          created_at: string
          related_type: Database["public"]["Enums"]["related_type_enum"] | null
          id: string
          lead_id: string
          milestone_name: string
          notes: string | null
          position: number
          updated_at: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          related_type?: Database["public"]["Enums"]["related_type_enum"] | null
          id?: string
          lead_id: string
          milestone_name: string
          notes?: string | null
          position?: number
          updated_at?: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          related_type?: Database["public"]["Enums"]["related_type_enum"] | null
          id?: string
          lead_id?: string
          milestone_name?: string
          notes?: string | null
          position?: number
          updated_at?: string
        }
        Relationships: []
      }
      deal_people: {
        Row: {
          created_at: string
          deal_id: string
          id: string
          person_id: string
          role: string | null
        }
        Insert: {
          created_at?: string
          deal_id: string
          id?: string
          person_id: string
          role?: string | null
        }
        Update: {
          created_at?: string
          deal_id?: string
          id?: string
          person_id?: string
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_people_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_people_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_waiting_on: {
        Row: {
          created_at: string
          description: string | null
          due_date: string | null
          related_type: Database["public"]["Enums"]["related_type_enum"] | null
          id: string
          lead_id: string
          owner: string
          resolved_at: string | null
          resolved_by: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          due_date?: string | null
          related_type?: Database["public"]["Enums"]["related_type_enum"] | null
          id?: string
          lead_id: string
          owner: string
          resolved_at?: string | null
          resolved_by?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          due_date?: string | null
          related_type?: Database["public"]["Enums"]["related_type_enum"] | null
          id?: string
          lead_id?: string
          owner?: string
          resolved_at?: string | null
          resolved_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      deals: {
        Row: {
          about: string | null
          actual_net_revenue: number | null
          assigned_to: string | null
          bank_relationships: string | null
          client_other_lenders: boolean
          close_date: string | null
          clx_agreement: boolean | null
          clx_file_name: string | null
          cohort_year: number | null
          company_name: string | null
          contact_type: string | null
          converted_at: string | null
          converted_to_client_id: string | null
          copper_opportunity_id: string | null
          created_at: string
          custom_fields: Json
          deal_outcome: Database["public"]["Enums"]["deal_outcome"]
          deal_value: number | null
          description: string | null
          email: string | null
          related_id: string
          fee_percent: number | null
          flagged_for_weekly: boolean
          history: string | null
          id: string
          initial_nudge_created_at: string | null
          interactions_count: number
          invoice_amount: number | null
          known_as: string | null
          last_activity_at: string | null
          last_contacted: string | null
          lender_name: string | null
          lender_type: string | null
          linkedin: string | null
          loan_category: string | null
          loan_stage: string | null
          loss_reason: string | null
          lost_at: string | null
          name: string
          net_revenue: number | null
          next_action: string | null
          notes: string | null
          opportunity_name: string | null
          phone: string | null
          pipeline: Database["public"]["Enums"]["deal_pipeline"]
          potential_revenue: number | null
          priority: Database["public"]["Enums"]["deal_priority"] | null
          qualified_at: string | null
          questionnaire_completed_at: string | null
          questionnaire_sent_at: string | null
          questionnaire_token: string | null
          ratewatch_questionnaire_completed_at: string | null
          ratewatch_questionnaire_sent_at: string | null
          ratewatch_questionnaire_token: string | null
          referral_source: string | null
          rs_fee_percent: number | null
          rs_revenue: number | null
          sheets_last_synced_at: string | null
          sheets_row_index: number | null
          sla_threshold_days: number | null
          source: string | null
          source_system: string
          stage_changed_at: string | null
          stage_id: string | null
          status: Database["public"]["Enums"]["lead_status"]
          tags: string[] | null
          target_closing_date: string | null
          title: string | null
          twitter: string | null
          updated_at: string
          uw_number: string | null
          visibility: string | null
          volume_log_status: string | null
          waiting_on: string | null
          website: string | null
          win_percentage: number | null
          won: boolean | null
          won_at: string | null
          won_reason: string | null
          work_website: string | null
          wu_date: string | null
        }
        Insert: {
          about?: string | null
          actual_net_revenue?: number | null
          assigned_to?: string | null
          bank_relationships?: string | null
          client_other_lenders?: boolean
          close_date?: string | null
          clx_agreement?: boolean | null
          clx_file_name?: string | null
          cohort_year?: number | null
          company_name?: string | null
          contact_type?: string | null
          converted_at?: string | null
          converted_to_client_id?: string | null
          copper_opportunity_id?: string | null
          created_at?: string
          custom_fields?: Json
          deal_outcome?: Database["public"]["Enums"]["deal_outcome"]
          deal_value?: number | null
          description?: string | null
          email?: string | null
          related_id: string
          fee_percent?: number | null
          flagged_for_weekly?: boolean
          history?: string | null
          id?: string
          initial_nudge_created_at?: string | null
          interactions_count?: number
          invoice_amount?: number | null
          known_as?: string | null
          last_activity_at?: string | null
          last_contacted?: string | null
          lender_name?: string | null
          lender_type?: string | null
          linkedin?: string | null
          loan_category?: string | null
          loan_stage?: string | null
          loss_reason?: string | null
          lost_at?: string | null
          name: string
          net_revenue?: number | null
          next_action?: string | null
          notes?: string | null
          opportunity_name?: string | null
          phone?: string | null
          pipeline?: Database["public"]["Enums"]["deal_pipeline"]
          potential_revenue?: number | null
          priority?: Database["public"]["Enums"]["deal_priority"] | null
          qualified_at?: string | null
          questionnaire_completed_at?: string | null
          questionnaire_sent_at?: string | null
          questionnaire_token?: string | null
          ratewatch_questionnaire_completed_at?: string | null
          ratewatch_questionnaire_sent_at?: string | null
          ratewatch_questionnaire_token?: string | null
          referral_source?: string | null
          rs_fee_percent?: number | null
          rs_revenue?: number | null
          sheets_last_synced_at?: string | null
          sheets_row_index?: number | null
          sla_threshold_days?: number | null
          source?: string | null
          source_system?: string
          stage_changed_at?: string | null
          stage_id?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          tags?: string[] | null
          target_closing_date?: string | null
          title?: string | null
          twitter?: string | null
          updated_at?: string
          uw_number?: string | null
          visibility?: string | null
          volume_log_status?: string | null
          waiting_on?: string | null
          website?: string | null
          win_percentage?: number | null
          won?: boolean | null
          won_at?: string | null
          won_reason?: string | null
          work_website?: string | null
          wu_date?: string | null
        }
        Update: {
          about?: string | null
          actual_net_revenue?: number | null
          assigned_to?: string | null
          bank_relationships?: string | null
          client_other_lenders?: boolean
          close_date?: string | null
          clx_agreement?: boolean | null
          clx_file_name?: string | null
          cohort_year?: number | null
          company_name?: string | null
          contact_type?: string | null
          converted_at?: string | null
          converted_to_client_id?: string | null
          copper_opportunity_id?: string | null
          created_at?: string
          custom_fields?: Json
          deal_outcome?: Database["public"]["Enums"]["deal_outcome"]
          deal_value?: number | null
          description?: string | null
          email?: string | null
          related_id?: string
          fee_percent?: number | null
          flagged_for_weekly?: boolean
          history?: string | null
          id?: string
          initial_nudge_created_at?: string | null
          interactions_count?: number
          invoice_amount?: number | null
          known_as?: string | null
          last_activity_at?: string | null
          last_contacted?: string | null
          lender_name?: string | null
          lender_type?: string | null
          linkedin?: string | null
          loan_category?: string | null
          loan_stage?: string | null
          loss_reason?: string | null
          lost_at?: string | null
          name?: string
          net_revenue?: number | null
          next_action?: string | null
          notes?: string | null
          opportunity_name?: string | null
          phone?: string | null
          pipeline?: Database["public"]["Enums"]["deal_pipeline"]
          potential_revenue?: number | null
          priority?: Database["public"]["Enums"]["deal_priority"] | null
          qualified_at?: string | null
          questionnaire_completed_at?: string | null
          questionnaire_sent_at?: string | null
          questionnaire_token?: string | null
          ratewatch_questionnaire_completed_at?: string | null
          ratewatch_questionnaire_sent_at?: string | null
          ratewatch_questionnaire_token?: string | null
          referral_source?: string | null
          rs_fee_percent?: number | null
          rs_revenue?: number | null
          sheets_last_synced_at?: string | null
          sheets_row_index?: number | null
          sla_threshold_days?: number | null
          source?: string | null
          source_system?: string
          stage_changed_at?: string | null
          stage_id?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          tags?: string[] | null
          target_closing_date?: string | null
          title?: string | null
          twitter?: string | null
          updated_at?: string
          uw_number?: string | null
          visibility?: string | null
          volume_log_status?: string | null
          waiting_on?: string | null
          website?: string | null
          win_percentage?: number | null
          won?: boolean | null
          won_at?: string | null
          won_reason?: string | null
          work_website?: string | null
          wu_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_related_id_fkey"
            columns: ["related_id"]
            isOneToOne: false
            referencedRelation: "related"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      dropbox_connections: {
        Row: {
          access_token: string
          account_id: string | null
          connected_by: string | null
          created_at: string | null
          cursor: string | null
          email: string
          id: string
          last_sync_at: string | null
          refresh_token: string
          token_expiry: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          account_id?: string | null
          connected_by?: string | null
          created_at?: string | null
          cursor?: string | null
          email: string
          id?: string
          last_sync_at?: string | null
          refresh_token: string
          token_expiry: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          account_id?: string | null
          connected_by?: string | null
          created_at?: string | null
          cursor?: string | null
          email?: string
          id?: string
          last_sync_at?: string | null
          refresh_token?: string
          token_expiry?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      dropbox_files: {
        Row: {
          content_hash: string | null
          created_at: string | null
          dropbox_id: string
          dropbox_path: string
          dropbox_path_display: string
          dropbox_rev: string | null
          related_type: Database["public"]["Enums"]["related_type_enum"] | null
          extracted_at: string | null
          extracted_text: string | null
          extraction_error: string | null
          extraction_status: string | null
          id: string
          is_folder: boolean
          lead_id: string | null
          mime_type: string | null
          modified_at: string | null
          name: string
          size: number | null
          synced_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content_hash?: string | null
          created_at?: string | null
          dropbox_id: string
          dropbox_path: string
          dropbox_path_display: string
          dropbox_rev?: string | null
          related_type?: Database["public"]["Enums"]["related_type_enum"] | null
          extracted_at?: string | null
          extracted_text?: string | null
          extraction_error?: string | null
          extraction_status?: string | null
          id?: string
          is_folder?: boolean
          lead_id?: string | null
          mime_type?: string | null
          modified_at?: string | null
          name: string
          size?: number | null
          synced_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content_hash?: string | null
          created_at?: string | null
          dropbox_id?: string
          dropbox_path?: string
          dropbox_path_display?: string
          dropbox_rev?: string | null
          related_type?: Database["public"]["Enums"]["related_type_enum"] | null
          extracted_at?: string | null
          extracted_text?: string | null
          extraction_error?: string | null
          extraction_status?: string | null
          id?: string
          is_folder?: boolean
          lead_id?: string | null
          mime_type?: string | null
          modified_at?: string | null
          name?: string
          size?: number | null
          synced_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dropbox_files_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body: string
          category: string | null
          created_at: string
          id: string
          name: string
          subject: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          body: string
          category?: string | null
          created_at?: string
          id?: string
          name: string
          subject: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          body?: string
          category?: string | null
          created_at?: string
          id?: string
          name?: string
          subject?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      email_threads: {
        Row: {
          assigned_to: string | null
          created_at: string | null
          related_type: Database["public"]["Enums"]["related_type_enum"] | null
          id: string
          is_triaged: boolean | null
          last_message_date: string | null
          last_outbound_date: string | null
          lead_id: string | null
          next_action: string | null
          sla_breached: boolean | null
          subject: string | null
          thread_id: string
          updated_at: string | null
          waiting_on: string | null
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string | null
          related_type?: Database["public"]["Enums"]["related_type_enum"] | null
          id?: string
          is_triaged?: boolean | null
          last_message_date?: string | null
          last_outbound_date?: string | null
          lead_id?: string | null
          next_action?: string | null
          sla_breached?: boolean | null
          subject?: string | null
          thread_id: string
          updated_at?: string | null
          waiting_on?: string | null
        }
        Update: {
          assigned_to?: string | null
          created_at?: string | null
          related_type?: Database["public"]["Enums"]["related_type_enum"] | null
          id?: string
          is_triaged?: boolean | null
          last_message_date?: string | null
          last_outbound_date?: string | null
          lead_id?: string | null
          next_action?: string | null
          sla_breached?: boolean | null
          subject?: string | null
          thread_id?: string
          updated_at?: string | null
          waiting_on?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_threads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_threads_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      related: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          kind: Database["public"]["Enums"]["related_kind"]
          source_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          kind: Database["public"]["Enums"]["related_kind"]
          source_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["related_kind"]
          source_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      related_addresses: {
        Row: {
          address_line_1: string | null
          address_line_2: string | null
          address_type: string | null
          city: string | null
          country: string | null
          created_at: string
          related_id: string
          related_type: Database["public"]["Enums"]["related_type_enum"] | null
          id: string
          is_primary: boolean | null
          state: string | null
          zip_code: string | null
        }
        Insert: {
          address_line_1?: string | null
          address_line_2?: string | null
          address_type?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          related_id: string
          related_type?: Database["public"]["Enums"]["related_type_enum"] | null
          id?: string
          is_primary?: boolean | null
          state?: string | null
          zip_code?: string | null
        }
        Update: {
          address_line_1?: string | null
          address_line_2?: string | null
          address_type?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          related_id?: string
          related_type?: Database["public"]["Enums"]["related_type_enum"] | null
          id?: string
          is_primary?: boolean | null
          state?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "related_addresses_related_id_fkey"
            columns: ["related_id"]
            isOneToOne: false
            referencedRelation: "related"
            referencedColumns: ["id"]
          },
        ]
      }
      related_contact_points: {
        Row: {
          created_at: string
          related_id: string
          related_type: Database["public"]["Enums"]["related_type_enum"] | null
          id: string
          is_primary: boolean | null
          kind: string
          label: string | null
          value: string
        }
        Insert: {
          created_at?: string
          related_id: string
          related_type?: Database["public"]["Enums"]["related_type_enum"] | null
          id?: string
          is_primary?: boolean | null
          kind: string
          label?: string | null
          value: string
        }
        Update: {
          created_at?: string
          related_id?: string
          related_type?: Database["public"]["Enums"]["related_type_enum"] | null
          id?: string
          is_primary?: boolean | null
          kind?: string
          label?: string | null
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "related_contact_points_related_id_fkey"
            columns: ["related_id"]
            isOneToOne: false
            referencedRelation: "related"
            referencedColumns: ["id"]
          },
        ]
      }
      related_files: {
        Row: {
          copper_file_id: string | null
          created_at: string
          related_id: string
          related_type: Database["public"]["Enums"]["related_type_enum"] | null
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          source_system: string
          uploaded_by: string | null
        }
        Insert: {
          copper_file_id?: string | null
          created_at?: string
          related_id: string
          related_type?: Database["public"]["Enums"]["related_type_enum"] | null
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          source_system?: string
          uploaded_by?: string | null
        }
        Update: {
          copper_file_id?: string | null
          created_at?: string
          related_id?: string
          related_type?: Database["public"]["Enums"]["related_type_enum"] | null
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          source_system?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "related_files_related_id_fkey"
            columns: ["related_id"]
            isOneToOne: false
            referencedRelation: "related"
            referencedColumns: ["id"]
          },
        ]
      }
      related_followers: {
        Row: {
          created_at: string | null
          related_id: string
          related_type: Database["public"]["Enums"]["related_type_enum"] | null
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          related_id: string
          related_type?: Database["public"]["Enums"]["related_type_enum"] | null
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          related_id?: string
          related_type?: Database["public"]["Enums"]["related_type_enum"] | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "related_followers_related_id_fkey"
            columns: ["related_id"]
            isOneToOne: false
            referencedRelation: "related"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "related_followers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      related_projects: {
        Row: {
          bank_relationships: string | null
          clx_file_name: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          related_id: string
          related_type: Database["public"]["Enums"]["related_type_enum"] | null
          id: string
          name: string
          owner: string | null
          priority: string | null
          project_stage: string | null
          related_to: string | null
          status: string | null
          tags: string[] | null
          updated_at: string
          visibility: string | null
          waiting_on: string | null
        }
        Insert: {
          bank_relationships?: string | null
          clx_file_name?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          related_id: string
          related_type?: Database["public"]["Enums"]["related_type_enum"] | null
          id?: string
          name: string
          owner?: string | null
          priority?: string | null
          project_stage?: string | null
          related_to?: string | null
          status?: string | null
          tags?: string[] | null
          updated_at?: string
          visibility?: string | null
          waiting_on?: string | null
        }
        Update: {
          bank_relationships?: string | null
          clx_file_name?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          related_id?: string
          related_type?: Database["public"]["Enums"]["related_type_enum"] | null
          id?: string
          name?: string
          owner?: string | null
          priority?: string | null
          project_stage?: string | null
          related_to?: string | null
          status?: string | null
          tags?: string[] | null
          updated_at?: string
          visibility?: string | null
          waiting_on?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "related_projects_related_id_fkey"
            columns: ["related_id"]
            isOneToOne: false
            referencedRelation: "related"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "related_projects_owner_fkey"
            columns: ["owner"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_reactions: {
        Row: {
          activity_id: string
          created_at: string
          emoji: string
          id: string
          user_id: string
          user_name: string | null
        }
        Insert: {
          activity_id: string
          created_at?: string
          emoji: string
          id?: string
          user_id: string
          user_name?: string | null
        }
        Update: {
          activity_id?: string
          created_at?: string
          emoji?: string
          id?: string
          user_id?: string
          user_name?: string | null
        }
        Relationships: []
      }
      google_connections: {
        Row: {
          access_token: string
          calendar_id: string | null
          created_at: string
          drive_watch_channel_id: string | null
          drive_watch_channel_token: string | null
          drive_watch_expiry: string | null
          drive_watch_resource_id: string | null
          drive_watch_spreadsheet_id: string | null
          email: string
          id: string
          needs_reauth: boolean
          refresh_token: string
          scopes: string | null
          token_expiry: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          calendar_id?: string | null
          created_at?: string
          drive_watch_channel_id?: string | null
          drive_watch_channel_token?: string | null
          drive_watch_expiry?: string | null
          drive_watch_resource_id?: string | null
          drive_watch_spreadsheet_id?: string | null
          email: string
          id?: string
          needs_reauth?: boolean
          refresh_token: string
          scopes?: string | null
          token_expiry: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          calendar_id?: string | null
          created_at?: string
          drive_watch_channel_id?: string | null
          drive_watch_channel_token?: string | null
          drive_watch_expiry?: string | null
          drive_watch_resource_id?: string | null
          drive_watch_spreadsheet_id?: string | null
          email?: string
          id?: string
          needs_reauth?: boolean
          refresh_token?: string
          scopes?: string | null
          token_expiry?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      hidden_email_threads: {
        Row: {
          created_at: string | null
          hidden_by: string
          id: string
          thread_id: string
        }
        Insert: {
          created_at?: string | null
          hidden_by: string
          id?: string
          thread_id: string
        }
        Update: {
          created_at?: string | null
          hidden_by?: string
          id?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hidden_email_threads_hidden_by_fkey"
            columns: ["hidden_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          client_id: string
          created_at: string
          description: string | null
          due_date: string
          id: string
          invoice_number: string
          notes: string | null
          paid_at: string | null
          payment_method: string | null
          payment_reference: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          updated_at: string
          viewed_at: string | null
        }
        Insert: {
          amount: number
          client_id: string
          created_at?: string
          description?: string | null
          due_date: string
          id?: string
          invoice_number: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          updated_at?: string
          viewed_at?: string | null
        }
        Update: {
          amount?: number
          client_id?: string
          created_at?: string
          description?: string | null
          due_date?: string
          id?: string
          invoice_number?: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          updated_at?: string
          viewed_at?: string | null
        }
        Relationships: []
      }
      lender_programs: {
        Row: {
          call_status: string | null
          contact_name: string | null
          created_at: string
          description: string | null
          email: string | null
          related_id: string
          id: string
          interest_range: string | null
          last_contact: string | null
          lender_name: string
          lender_specialty: string | null
          lender_type: string | null
          loan_size_text: string | null
          loan_types: string | null
          location: string | null
          looking_for: string | null
          max_loan: number | null
          min_loan: number | null
          next_call: string | null
          phone: string | null
          program_name: string
          program_type: string
          states: string | null
          term: string | null
          updated_at: string
        }
        Insert: {
          call_status?: string | null
          contact_name?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          related_id: string
          id?: string
          interest_range?: string | null
          last_contact?: string | null
          lender_name: string
          lender_specialty?: string | null
          lender_type?: string | null
          loan_size_text?: string | null
          loan_types?: string | null
          location?: string | null
          looking_for?: string | null
          max_loan?: number | null
          min_loan?: number | null
          next_call?: string | null
          phone?: string | null
          program_name: string
          program_type: string
          states?: string | null
          term?: string | null
          updated_at?: string
        }
        Update: {
          call_status?: string | null
          contact_name?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          related_id?: string
          id?: string
          interest_range?: string | null
          last_contact?: string | null
          lender_name?: string
          lender_specialty?: string | null
          lender_type?: string | null
          loan_size_text?: string | null
          loan_types?: string | null
          location?: string | null
          looking_for?: string | null
          max_loan?: number | null
          min_loan?: number | null
          next_call?: string | null
          phone?: string | null
          program_name?: string
          program_type?: string
          states?: string | null
          term?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lender_programs_related_id_fkey"
            columns: ["related_id"]
            isOneToOne: false
            referencedRelation: "related"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          read_at: string | null
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_read: boolean | null
          link_url: string | null
          target_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_read?: boolean | null
          link_url?: string | null
          target_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_read?: boolean | null
          link_url?: string | null
          target_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      outbound_emails: {
        Row: {
          body_html: string
          body_plain: string
          cc_emails: string | null
          created_at: string
          related_type: Database["public"]["Enums"]["related_type_enum"] | null
          error: string | null
          flow_id: string
          gmail_message_id: string | null
          gmail_thread_id: string | null
          id: string
          lead_id: string | null
          reply_in_reply_to: string | null
          reply_thread_id: string | null
          sent_at: string | null
          source: string
          status: string
          subject: string
          to_email: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body_html?: string
          body_plain?: string
          cc_emails?: string | null
          created_at?: string
          related_type?: Database["public"]["Enums"]["related_type_enum"] | null
          error?: string | null
          flow_id: string
          gmail_message_id?: string | null
          gmail_thread_id?: string | null
          id?: string
          lead_id?: string | null
          reply_in_reply_to?: string | null
          reply_thread_id?: string | null
          sent_at?: string | null
          source?: string
          status?: string
          subject: string
          to_email: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body_html?: string
          body_plain?: string
          cc_emails?: string | null
          created_at?: string
          related_type?: Database["public"]["Enums"]["related_type_enum"] | null
          error?: string | null
          flow_id?: string
          gmail_message_id?: string | null
          gmail_thread_id?: string | null
          id?: string
          lead_id?: string | null
          reply_in_reply_to?: string | null
          reply_thread_id?: string | null
          sent_at?: string | null
          source?: string
          status?: string
          subject?: string
          to_email?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      people: {
        Row: {
          about: string | null
          assigned_to: string | null
          bank_relationships: string | null
          clx_file_name: string | null
          company_id: string | null
          company_name: string | null
          contact_type: string | null
          copper_person_id: string | null
          created_at: string
          description: string | null
          email: string | null
          related_id: string
          history: string | null
          id: string
          known_as: string | null
          last_activity_at: string | null
          last_contacted: string | null
          linkedin: string | null
          name: string
          notes: string | null
          phone: string | null
          referral_source: string | null
          source: string | null
          source_system: string
          tags: string[] | null
          title: string | null
          twitter: string | null
          updated_at: string
          website: string | null
          work_website: string | null
        }
        Insert: {
          about?: string | null
          assigned_to?: string | null
          bank_relationships?: string | null
          clx_file_name?: string | null
          company_id?: string | null
          company_name?: string | null
          contact_type?: string | null
          copper_person_id?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          related_id: string
          history?: string | null
          id?: string
          known_as?: string | null
          last_activity_at?: string | null
          last_contacted?: string | null
          linkedin?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          referral_source?: string | null
          source?: string | null
          source_system?: string
          tags?: string[] | null
          title?: string | null
          twitter?: string | null
          updated_at?: string
          website?: string | null
          work_website?: string | null
        }
        Update: {
          about?: string | null
          assigned_to?: string | null
          bank_relationships?: string | null
          clx_file_name?: string | null
          company_id?: string | null
          company_name?: string | null
          contact_type?: string | null
          copper_person_id?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          related_id?: string
          history?: string | null
          id?: string
          known_as?: string | null
          last_activity_at?: string | null
          last_contacted?: string | null
          linkedin?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          referral_source?: string | null
          source?: string | null
          source_system?: string
          tags?: string[] | null
          title?: string | null
          twitter?: string | null
          updated_at?: string
          website?: string | null
          work_website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "people_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_related_id_fkey"
            columns: ["related_id"]
            isOneToOne: false
            referencedRelation: "related"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_shares: {
        Row: {
          access_level: string
          created_at: string
          created_by: string | null
          id: string
          owner_id: string
          shared_with_id: string
          updated_at: string
        }
        Insert: {
          access_level?: string
          created_at?: string
          created_by?: string | null
          id?: string
          owner_id: string
          shared_with_id: string
          updated_at?: string
        }
        Update: {
          access_level?: string
          created_at?: string
          created_by?: string | null
          id?: string
          owner_id?: string
          shared_with_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_shares_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_shares_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_shares_shared_with_id_fkey"
            columns: ["shared_with_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_stages: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          pipeline_id: string
          position: number
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          pipeline_id: string
          position?: number
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          pipeline_id?: string
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      pipelines: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_main: boolean | null
          is_system: boolean
          name: string
          owner_id: string
          template_type: string | null
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_main?: boolean | null
          is_system?: boolean
          name: string
          owner_id: string
          template_type?: string | null
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_main?: boolean | null
          is_system?: boolean
          name?: string
          owner_id?: string
          template_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipelines_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      project_people: {
        Row: {
          created_at: string
          related_type: Database["public"]["Enums"]["related_type_enum"] | null
          id: string
          lead_id: string
          project_id: string
          role: string | null
        }
        Insert: {
          created_at?: string
          related_type?: Database["public"]["Enums"]["related_type_enum"] | null
          id?: string
          lead_id: string
          project_id: string
          role?: string | null
        }
        Update: {
          created_at?: string
          related_type?: Database["public"]["Enums"]["related_type_enum"] | null
          id?: string
          lead_id?: string
          project_id?: string
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_people_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "related_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          function_name: string
          id: string
          ip_address: string
          request_count: number
          window_start: string
        }
        Insert: {
          function_name: string
          id?: string
          ip_address: string
          request_count?: number
          window_start?: string
        }
        Update: {
          function_name?: string
          id?: string
          ip_address?: string
          request_count?: number
          window_start?: string
        }
        Relationships: []
      }
      rate_watch: {
        Row: {
          amortization: string | null
          collateral_type: string | null
          collateral_value: number | null
          confirm_email: boolean | null
          created_at: string
          current_rate: number
          enrolled_at: string
          related_type: Database["public"]["Enums"]["related_type_enum"] | null
          estimated_cf: number | null
          id: string
          initial_review: string | null
          is_active: boolean
          last_contacted_at: string | null
          lead_id: string
          lender_type: string | null
          loan_amount: number | null
          loan_maturity: string | null
          loan_type: string | null
          notes: string | null
          occupancy_use: string | null
          original_term_years: number | null
          owner_occupied_pct: number | null
          penalty: string | null
          rate_type: string | null
          re_location: string | null
          seeking_to_improve: string | null
          target_rate: number
          updated_at: string
          variable_index_spread: string | null
        }
        Insert: {
          amortization?: string | null
          collateral_type?: string | null
          collateral_value?: number | null
          confirm_email?: boolean | null
          created_at?: string
          current_rate: number
          enrolled_at?: string
          related_type?: Database["public"]["Enums"]["related_type_enum"] | null
          estimated_cf?: number | null
          id?: string
          initial_review?: string | null
          is_active?: boolean
          last_contacted_at?: string | null
          lead_id: string
          lender_type?: string | null
          loan_amount?: number | null
          loan_maturity?: string | null
          loan_type?: string | null
          notes?: string | null
          occupancy_use?: string | null
          original_term_years?: number | null
          owner_occupied_pct?: number | null
          penalty?: string | null
          rate_type?: string | null
          re_location?: string | null
          seeking_to_improve?: string | null
          target_rate: number
          updated_at?: string
          variable_index_spread?: string | null
        }
        Update: {
          amortization?: string | null
          collateral_type?: string | null
          collateral_value?: number | null
          confirm_email?: boolean | null
          created_at?: string
          current_rate?: number
          enrolled_at?: string
          related_type?: Database["public"]["Enums"]["related_type_enum"] | null
          estimated_cf?: number | null
          id?: string
          initial_review?: string | null
          is_active?: boolean
          last_contacted_at?: string | null
          lead_id?: string
          lender_type?: string | null
          loan_amount?: number | null
          loan_maturity?: string | null
          loan_type?: string | null
          notes?: string | null
          occupancy_use?: string | null
          original_term_years?: number | null
          owner_occupied_pct?: number | null
          penalty?: string | null
          rate_type?: string | null
          re_location?: string | null
          seeking_to_improve?: string | null
          target_rate?: number
          updated_at?: string
          variable_index_spread?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rate_watch_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      ratewatch_questionnaire_responses: {
        Row: {
          additional_notes: string | null
          amortization: string | null
          business_description: string | null
          collateral_type: string | null
          collateral_value: number | null
          contact_method: string | null
          created_at: string
          current_lender: string | null
          current_rate: number | null
          email: string | null
          related_type: Database["public"]["Enums"]["related_type_enum"] | null
          estimated_cash_flow: number | null
          first_name: string | null
          id: string
          last_name: string | null
          lead_id: string | null
          lender_type: string | null
          loan_balance: number | null
          loan_maturity: string | null
          loan_type: string | null
          original_term_years: number | null
          owner_occupied_pct: number | null
          phone: string | null
          prepayment_penalty: string | null
          property_occupancy: string | null
          rate_type: string | null
          re_city_state: string | null
          seeking_to_improve: string | null
          submitted_at: string
          target_rate: number | null
          variable_index_spread: string | null
        }
        Insert: {
          additional_notes?: string | null
          amortization?: string | null
          business_description?: string | null
          collateral_type?: string | null
          collateral_value?: number | null
          contact_method?: string | null
          created_at?: string
          current_lender?: string | null
          current_rate?: number | null
          email?: string | null
          related_type?: Database["public"]["Enums"]["related_type_enum"] | null
          estimated_cash_flow?: number | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          lead_id?: string | null
          lender_type?: string | null
          loan_balance?: number | null
          loan_maturity?: string | null
          loan_type?: string | null
          original_term_years?: number | null
          owner_occupied_pct?: number | null
          phone?: string | null
          prepayment_penalty?: string | null
          property_occupancy?: string | null
          rate_type?: string | null
          re_city_state?: string | null
          seeking_to_improve?: string | null
          submitted_at?: string
          target_rate?: number | null
          variable_index_spread?: string | null
        }
        Update: {
          additional_notes?: string | null
          amortization?: string | null
          business_description?: string | null
          collateral_type?: string | null
          collateral_value?: number | null
          contact_method?: string | null
          created_at?: string
          current_lender?: string | null
          current_rate?: number | null
          email?: string | null
          related_type?: Database["public"]["Enums"]["related_type_enum"] | null
          estimated_cash_flow?: number | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          lead_id?: string | null
          lender_type?: string | null
          loan_balance?: number | null
          loan_maturity?: string | null
          loan_type?: string | null
          original_term_years?: number | null
          owner_occupied_pct?: number | null
          phone?: string | null
          prepayment_penalty?: string | null
          property_occupancy?: string | null
          rate_type?: string | null
          re_city_state?: string | null
          seeking_to_improve?: string | null
          submitted_at?: string
          target_rate?: number | null
          variable_index_spread?: string | null
        }
        Relationships: []
      }
      revenue_targets: {
        Row: {
          created_at: string
          current_amount: number
          forecast_amount: number
          forecast_confidence: number
          id: string
          pace_vs_plan: number
          period_type: string
          target_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_amount?: number
          forecast_amount?: number
          forecast_confidence?: number
          id?: string
          pace_vs_plan?: number
          period_type: string
          target_amount?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_amount?: number
          forecast_amount?: number
          forecast_confidence?: number
          id?: string
          pace_vs_plan?: number
          period_type?: string
          target_amount?: number
          updated_at?: string
        }
        Relationships: []
      }
      task_activities: {
        Row: {
          activity_type: string
          content: string | null
          created_at: string
          created_by: string | null
          id: string
          mentioned_users: string[] | null
          new_value: string | null
          old_value: string | null
          task_id: string
          user_id: string | null
        }
        Insert: {
          activity_type: string
          content?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          mentioned_users?: string[] | null
          new_value?: string | null
          old_value?: string | null
          task_id: string
          user_id?: string | null
        }
        Update: {
          activity_type?: string
          content?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          mentioned_users?: string[] | null
          new_value?: string | null
          old_value?: string | null
          task_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evan_task_activities_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_activities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      task_saved_filters: {
        Row: {
          created_at: string | null
          created_by: string | null
          criteria: Json
          description: string | null
          id: string
          name: string
          position: number
          updated_at: string | null
          visibility: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          criteria?: Json
          description?: string | null
          id?: string
          name: string
          position?: number
          updated_at?: string | null
          visibility?: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          criteria?: Json
          description?: string | null
          id?: string
          name?: string
          position?: number
          updated_at?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_saved_filters_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          completed_at: string | null
          copper_task_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          related_id: string | null
          related_type: Database["public"]["Enums"]["related_type_enum"] | null
          estimated_hours: number | null
          group_name: string | null
          id: string
          is_completed: boolean
          lead_id: string | null
          priority: string | null
          source: string | null
          source_system: string
          status: string | null
          tags: string[] | null
          task_type: string | null
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          copper_task_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          related_id?: string | null
          related_type?: Database["public"]["Enums"]["related_type_enum"] | null
          estimated_hours?: number | null
          group_name?: string | null
          id?: string
          is_completed?: boolean
          lead_id?: string | null
          priority?: string | null
          source?: string | null
          source_system?: string
          status?: string | null
          tags?: string[] | null
          task_type?: string | null
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          copper_task_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          related_id?: string | null
          related_type?: Database["public"]["Enums"]["related_type_enum"] | null
          estimated_hours?: number | null
          group_name?: string | null
          id?: string
          is_completed?: boolean
          lead_id?: string | null
          priority?: string | null
          source?: string | null
          source_system?: string
          status?: string | null
          tags?: string[] | null
          task_type?: string | null
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          address: string | null
          app_role: Database["public"]["Enums"]["app_role"] | null
          avatar_url: string | null
          city: string | null
          company_name: string | null
          contact_person: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          is_assignable: boolean
          is_owner: boolean | null
          name: string
          phone: string | null
          position: string | null
          state: string | null
          twilio_phone_number: string | null
          updated_at: string
          user_id: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          app_role?: Database["public"]["Enums"]["app_role"] | null
          avatar_url?: string | null
          city?: string | null
          company_name?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          is_assignable?: boolean
          is_owner?: boolean | null
          name: string
          phone?: string | null
          position?: string | null
          state?: string | null
          twilio_phone_number?: string | null
          updated_at?: string
          user_id?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          app_role?: Database["public"]["Enums"]["app_role"] | null
          avatar_url?: string | null
          city?: string | null
          company_name?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          is_assignable?: boolean
          is_owner?: boolean | null
          name?: string
          phone?: string | null
          position?: string | null
          state?: string | null
          twilio_phone_number?: string | null
          updated_at?: string
          user_id?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      volume_log_sync_config: {
        Row: {
          column_mapping: Json
          created_at: string | null
          created_by: string | null
          header_row: Json | null
          id: string
          last_pull_at: string | null
          last_push_at: string | null
          sheet_name: string | null
          spreadsheet_id: string
          updated_at: string | null
        }
        Insert: {
          column_mapping?: Json
          created_at?: string | null
          created_by?: string | null
          header_row?: Json | null
          id?: string
          last_pull_at?: string | null
          last_push_at?: string | null
          sheet_name?: string | null
          spreadsheet_id: string
          updated_at?: string | null
        }
        Update: {
          column_mapping?: Json
          created_at?: string | null
          created_by?: string | null
          header_row?: Json | null
          id?: string
          last_pull_at?: string | null
          last_push_at?: string | null
          sheet_name?: string | null
          spreadsheet_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      v_pipeline_metrics: {
        Row: {
          deal_count: number | null
          median_days: number | null
          stage: string | null
          total_requested: number | null
          total_weighted_fees: number | null
        }
        Relationships: []
      }
      v_referral_analytics: {
        Row: {
          last_contact_days_ago: number | null
          name: string | null
          status: string | null
          total_revenue: number | null
        }
        Insert: {
          last_contact_days_ago?: number | null
          name?: string | null
          status?: string | null
          total_revenue?: number | null
        }
        Update: {
          last_contact_days_ago?: number | null
          name?: string | null
          status?: string | null
          total_revenue?: number | null
        }
        Relationships: []
      }
      v_team_performance: {
        Row: {
          active_deals: number | null
          avg_days: number | null
          closings: number | null
          conversion: number | null
          name: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      can_access_team_member: {
        Args: { _team_member_name: string }
        Returns: boolean
      }
      check_rate_limit: {
        Args: {
          p_func: string
          p_ip: string
          p_limit: number
          p_window_secs: number
        }
        Returns: {
          allowed: boolean
          current_count: number
          retry_after: number
        }[]
      }
      cleanup_expired_rate_limits: { Args: never; Returns: undefined }
      compute_deal_revenue: {
        Args: {
          deal_value: number
          fee_percent: number
          potential_revenue: number
        }
        Returns: number
      }
      current_team_member_id: { Args: never; Returns: string }
      get_current_team_member: {
        Args: never
        Returns: {
          email: string
          id: string
          is_owner: boolean
          name: string
          position: string
        }[]
      }
      get_funded_deals_summary: {
        Args: { p_assigned_to?: string; p_from: string; p_to: string }
        Returns: {
          funded_count: number
          total_actual_net_revenue: number
          total_expected_revenue: number
          total_loan_value: number
        }[]
      }
      get_invoice_summary: {
        Args: {
          p_min_amount?: number
          p_overdue_only?: boolean
          p_status?: string
        }
        Returns: {
          invoice_count: number
          overdue_amount: number
          overdue_count: number
          total_amount: number
        }[]
      }
      get_pipeline_value: {
        Args: { p_assigned_to?: string; p_pipeline?: string }
        Returns: {
          open_count: number
          pipeline: string
          total_expected_revenue: number
          total_value: number
        }[]
      }
      get_revenue_vs_target: {
        Args: { p_period_type: string }
        Returns: {
          actual_amount: number
          forecast_amount: number
          pace_vs_plan: number
          period_type: string
          target_amount: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_team_owner: { Args: never; Returns: boolean }
      run_read_sql: { Args: { p_query: string }; Returns: Json }
    }
    Enums: {
      ai_event_type:
        | "conversation"
        | "message"
        | "audit"
        | "agent_batch"
        | "agent_change"
      app_role: "admin" | "client" | "partner" | "super_admin"
      deal_outcome: "open" | "won" | "lost" | "abandoned"
      deal_outcome_enum: "open" | "won" | "lost" | "abandoned"
      deal_pipeline: "potential" | "underwriting" | "lender_management"
      deal_priority: "low" | "medium" | "high"
      related_kind: "people" | "companies" | "deal" | "lender_programs"
      related_type_enum:
        | "pipeline"
        | "underwriting"
        | "lender_management"
        | "people"
        | "companies"
        | "potential"
        | "deal"
        | "lender_programs"
      invoice_status:
        | "draft"
        | "sent"
        | "viewed"
        | "paid"
        | "overdue"
        | "cancelled"
      lead_status:
        | "discovery"
        | "pre_qualification"
        | "document_collection"
        | "underwriting"
        | "approval"
        | "funded"
        | "lost"
        | "initial_review"
        | "moving_to_underwriting"
        | "onboarding"
        | "ready_for_wu_approval"
        | "pre_approval_issued"
        | "won"
        | "questionnaire"
        | "review_kill_keep"
        | "waiting_on_needs_list"
        | "waiting_on_client"
        | "complete_files_for_review"
        | "need_structure_from_brad"
        | "maura_underwriting"
        | "brad_underwriting"
        | "uw_paused"
        | "need_structure"
        | "underwriting_review"
        | "senior_underwriting"
      pipeline_column_type:
        | "free_form"
        | "date"
        | "checkbox"
        | "dropdown"
        | "tag"
        | "formula"
        | "assigned_to"
        | "contact"
      transcription_status:
        | "not_applicable"
        | "pending"
        | "processing"
        | "completed"
        | "failed"
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
      ai_event_type: [
        "conversation",
        "message",
        "audit",
        "agent_batch",
        "agent_change",
      ],
      app_role: ["admin", "client", "partner", "super_admin"],
      deal_outcome: ["open", "won", "lost", "abandoned"],
      deal_outcome_enum: ["open", "won", "lost", "abandoned"],
      deal_pipeline: ["potential", "underwriting", "lender_management"],
      deal_priority: ["low", "medium", "high"],
      related_kind: ["people", "companies", "deal", "lender_programs"],
      related_type_enum: [
        "pipeline",
        "underwriting",
        "lender_management",
        "people",
        "companies",
        "potential",
        "deal",
        "lender_programs",
      ],
      invoice_status: [
        "draft",
        "sent",
        "viewed",
        "paid",
        "overdue",
        "cancelled",
      ],
      lead_status: [
        "discovery",
        "pre_qualification",
        "document_collection",
        "underwriting",
        "approval",
        "funded",
        "lost",
        "initial_review",
        "moving_to_underwriting",
        "onboarding",
        "ready_for_wu_approval",
        "pre_approval_issued",
        "won",
        "questionnaire",
        "review_kill_keep",
        "waiting_on_needs_list",
        "waiting_on_client",
        "complete_files_for_review",
        "need_structure_from_brad",
        "maura_underwriting",
        "brad_underwriting",
        "uw_paused",
        "need_structure",
        "underwriting_review",
        "senior_underwriting",
      ],
      pipeline_column_type: [
        "free_form",
        "date",
        "checkbox",
        "dropdown",
        "tag",
        "formula",
        "assigned_to",
        "contact",
      ],
      transcription_status: [
        "not_applicable",
        "pending",
        "processing",
        "completed",
        "failed",
      ],
    },
  },
} as const
