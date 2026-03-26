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
          from_number: string
          frontend_ack_at: string | null
          id: string
          lead_id: string | null
          status: string
          to_number: string
          updated_at: string
          webhook_timestamp: string | null
        }
        Insert: {
          answered_at?: string | null
          call_flow_id?: string | null
          call_sid: string
          created_at?: string
          direction?: string
          ended_at?: string | null
          from_number: string
          frontend_ack_at?: string | null
          id?: string
          lead_id?: string | null
          status?: string
          to_number: string
          updated_at?: string
          webhook_timestamp?: string | null
        }
        Update: {
          answered_at?: string | null
          call_flow_id?: string | null
          call_sid?: string
          created_at?: string
          direction?: string
          ended_at?: string | null
          from_number?: string
          frontend_ack_at?: string | null
          id?: string
          lead_id?: string | null
          status?: string
          to_number?: string
          updated_at?: string
          webhook_timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "active_calls_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_comments: {
        Row: {
          activity_id: string
          content: string
          created_at: string
          created_by: string | null
          id: string
          lead_id: string
        }
        Insert: {
          activity_id: string
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id: string
        }
        Update: {
          activity_id?: string
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_comments_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "lead_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_comments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agent_batches: {
        Row: {
          conversation_id: string | null
          created_at: string | null
          id: string
          mode: string
          prompt_summary: string | null
          status: string
          total_changes: number | null
          user_id: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          mode: string
          prompt_summary?: string | null
          status?: string
          total_changes?: number | null
          user_id: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          mode?: string
          prompt_summary?: string | null
          status?: string
          total_changes?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_batches_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agent_changes: {
        Row: {
          ai_reasoning: string | null
          batch_id: string | null
          batch_order: number | null
          conversation_id: string | null
          created_at: string | null
          description: string
          id: string
          mode: string
          model_used: string | null
          new_values: Json
          old_values: Json | null
          operation: string
          status: string
          target_id: string
          target_table: string
          team_member_id: string | null
          undone_at: string | null
          undone_by: string | null
          user_id: string
        }
        Insert: {
          ai_reasoning?: string | null
          batch_id?: string | null
          batch_order?: number | null
          conversation_id?: string | null
          created_at?: string | null
          description: string
          id?: string
          mode: string
          model_used?: string | null
          new_values: Json
          old_values?: Json | null
          operation: string
          status?: string
          target_id: string
          target_table: string
          team_member_id?: string | null
          undone_at?: string | null
          undone_by?: string | null
          user_id: string
        }
        Update: {
          ai_reasoning?: string | null
          batch_id?: string | null
          batch_order?: number | null
          conversation_id?: string | null
          created_at?: string | null
          description?: string
          id?: string
          mode?: string
          model_used?: string | null
          new_values?: Json
          old_values?: Json | null
          operation?: string
          status?: string
          target_id?: string
          target_table?: string
          team_member_id?: string | null
          undone_at?: string | null
          undone_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_changes_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "ai_agent_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agent_changes_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agent_changes_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_conversation_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          message_type: string | null
          metadata: Json | null
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          message_type?: string | null
          metadata?: Json | null
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          message_type?: string | null
          metadata?: Json | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversation_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_conversations: {
        Row: {
          created_at: string
          id: string
          mode: string | null
          title: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          mode?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          mode?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      appointments: {
        Row: {
          appointment_type: string | null
          created_at: string
          description: string | null
          end_time: string | null
          google_calendar_id: string | null
          google_event_id: string | null
          id: string
          lead_id: string | null
          start_time: string
          sync_status: string | null
          synced_at: string | null
          team_member_id: string | null
          team_member_name: string | null
          title: string
          updated_at: string
        }
        Insert: {
          appointment_type?: string | null
          created_at?: string
          description?: string | null
          end_time?: string | null
          google_calendar_id?: string | null
          google_event_id?: string | null
          id?: string
          lead_id?: string | null
          start_time: string
          sync_status?: string | null
          synced_at?: string | null
          team_member_id?: string | null
          team_member_name?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          appointment_type?: string | null
          created_at?: string
          description?: string | null
          end_time?: string | null
          google_calendar_id?: string | null
          google_event_id?: string | null
          id?: string
          lead_id?: string | null
          start_time?: string
          sync_status?: string | null
          synced_at?: string | null
          team_member_id?: string | null
          team_member_name?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evan_appointments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
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
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      business_requirements: {
        Row: {
          acceptance_criteria: string | null
          assigned_to: string | null
          created_at: string
          description: string | null
          id: string
          is_built: boolean
          module_id: string | null
          portal: string | null
          priority: string
          requirement_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          acceptance_criteria?: string | null
          assigned_to?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_built?: boolean
          module_id?: string | null
          portal?: string | null
          priority?: string
          requirement_id: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          acceptance_criteria?: string | null
          assigned_to?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_built?: boolean
          module_id?: string | null
          portal?: string | null
          priority?: string
          requirement_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_requirements_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_connections: {
        Row: {
          access_token: string
          calendar_id: string | null
          created_at: string
          email: string
          id: string
          refresh_token: string
          team_member_name: string | null
          token_expiry: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          calendar_id?: string | null
          created_at?: string
          email: string
          id?: string
          refresh_token: string
          team_member_name?: string | null
          token_expiry: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          calendar_id?: string | null
          created_at?: string
          email?: string
          id?: string
          refresh_token?: string
          team_member_name?: string | null
          token_expiry?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      call_events: {
        Row: {
          call_flow_id: string
          call_sid: string
          created_at: string
          db_inserted: boolean | null
          device_ready: boolean | null
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
        Relationships: [
          {
            foreignKeyName: "call_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      call_rating_notifications: {
        Row: {
          call_date: string
          call_direction: string
          call_rating: number
          communication_id: string | null
          created_at: string
          id: string
          lead_id: string | null
          rating_reasoning: string | null
          read_at: string | null
          transcript_preview: string | null
        }
        Insert: {
          call_date: string
          call_direction?: string
          call_rating: number
          communication_id?: string | null
          created_at?: string
          id?: string
          lead_id?: string | null
          rating_reasoning?: string | null
          read_at?: string | null
          transcript_preview?: string | null
        }
        Update: {
          call_date?: string
          call_direction?: string
          call_rating?: number
          communication_id?: string | null
          created_at?: string
          id?: string
          lead_id?: string | null
          rating_reasoning?: string | null
          read_at?: string | null
          transcript_preview?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_rating_notifications_communication_id_fkey"
            columns: ["communication_id"]
            isOneToOne: false
            referencedRelation: "communications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_rating_notifications_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_template_items: {
        Row: {
          assigned_to: string | null
          created_at: string
          due_date: string | null
          id: string
          position: number
          template_id: string
          text: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          position?: number
          template_id: string
          text: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          position?: number
          template_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_templates: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
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
          id: string
          lead_id: string | null
          phone_number: string | null
          recording_sid: string | null
          recording_url: string | null
          status: string | null
          team_member_id: string | null
          transcript: string | null
        }
        Insert: {
          call_sid?: string | null
          communication_type: string
          content?: string | null
          created_at?: string
          direction: string
          duration_seconds?: number | null
          id?: string
          lead_id?: string | null
          phone_number?: string | null
          recording_sid?: string | null
          recording_url?: string | null
          status?: string | null
          team_member_id?: string | null
          transcript?: string | null
        }
        Update: {
          call_sid?: string | null
          communication_type?: string
          content?: string | null
          created_at?: string
          direction?: string
          duration_seconds?: number | null
          id?: string
          lead_id?: string | null
          phone_number?: string | null
          recording_sid?: string | null
          recording_url?: string | null
          status?: string | null
          team_member_id?: string | null
          transcript?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communications_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evan_communications_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          client_id: string
          content: string
          created_at: string
          expires_at: string | null
          id: string
          sent_at: string | null
          signature_data: string | null
          signed_at: string | null
          signer_ip: string | null
          signer_name: string | null
          status: Database["public"]["Enums"]["contract_status"]
          title: string
          updated_at: string
          viewed_at: string | null
        }
        Insert: {
          client_id: string
          content: string
          created_at?: string
          expires_at?: string | null
          id?: string
          sent_at?: string | null
          signature_data?: string | null
          signed_at?: string | null
          signer_ip?: string | null
          signer_name?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          title: string
          updated_at?: string
          viewed_at?: string | null
        }
        Update: {
          client_id?: string
          content?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          sent_at?: string | null
          signature_data?: string | null
          signed_at?: string | null
          signer_ip?: string | null
          signer_name?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          title?: string
          updated_at?: string
          viewed_at?: string | null
        }
        Relationships: []
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
          team_member_id: string | null
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
          team_member_id?: string | null
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
          team_member_id?: string | null
          weighted_fees?: number
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_deals_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
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
      deal_milestones: {
        Row: {
          completed: boolean
          completed_at: string | null
          completed_by: string | null
          created_at: string
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
          id?: string
          lead_id?: string
          milestone_name?: string
          notes?: string | null
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_milestones_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_waiting_on: {
        Row: {
          created_at: string
          description: string | null
          due_date: string | null
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
          id?: string
          lead_id?: string
          owner?: string
          resolved_at?: string | null
          resolved_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_waiting_on_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
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
        }
        Insert: {
          content_hash?: string | null
          created_at?: string | null
          dropbox_id: string
          dropbox_path: string
          dropbox_path_display: string
          dropbox_rev?: string | null
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
        }
        Update: {
          content_hash?: string | null
          created_at?: string | null
          dropbox_id?: string
          dropbox_path?: string
          dropbox_path_display?: string
          dropbox_rev?: string | null
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
        }
        Relationships: [
          {
            foreignKeyName: "dropbox_files_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      email_metadata: {
        Row: {
          created_at: string
          gmail_message_id: string
          gmail_thread_id: string | null
          id: string
          is_fyi: boolean | null
          last_activity_date: string | null
          lead_id: string | null
          next_action: string | null
          sla_breach: boolean | null
          sla_due_date: string | null
          updated_at: string
          user_id: string
          waiting_on: string | null
        }
        Insert: {
          created_at?: string
          gmail_message_id: string
          gmail_thread_id?: string | null
          id?: string
          is_fyi?: boolean | null
          last_activity_date?: string | null
          lead_id?: string | null
          next_action?: string | null
          sla_breach?: boolean | null
          sla_due_date?: string | null
          updated_at?: string
          user_id: string
          waiting_on?: string | null
        }
        Update: {
          created_at?: string
          gmail_message_id?: string
          gmail_thread_id?: string | null
          id?: string
          is_fyi?: boolean | null
          last_activity_date?: string | null
          lead_id?: string | null
          next_action?: string | null
          sla_breach?: boolean | null
          sla_due_date?: string | null
          updated_at?: string
          user_id?: string
          waiting_on?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_metadata_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
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
          team_member_id: string | null
          updated_at: string
        }
        Insert: {
          body: string
          category?: string | null
          created_at?: string
          id?: string
          name: string
          subject: string
          team_member_id?: string | null
          updated_at?: string
        }
        Update: {
          body?: string
          category?: string | null
          created_at?: string
          id?: string
          name?: string
          subject?: string
          team_member_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      email_threads: {
        Row: {
          assigned_to: string | null
          created_at: string | null
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
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_threads_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      gmail_connections: {
        Row: {
          access_token: string
          created_at: string
          email: string
          id: string
          refresh_token: string
          token_expiry: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          email: string
          id?: string
          refresh_token: string
          token_expiry: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          email?: string
          id?: string
          refresh_token?: string
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
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          amount: number
          created_at: string
          description: string
          id: string
          invoice_id: string
          quantity: number
          unit_price: number
        }
        Insert: {
          amount: number
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          quantity?: number
          unit_price: number
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
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
      lead_activities: {
        Row: {
          activity_type: string
          content: string | null
          created_at: string
          created_by: string | null
          id: string
          lead_id: string
          title: string | null
        }
        Insert: {
          activity_type: string
          content?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id: string
          title?: string | null
        }
        Update: {
          activity_type?: string
          content?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_addresses: {
        Row: {
          address_line_1: string | null
          address_line_2: string | null
          address_type: string | null
          city: string | null
          country: string | null
          created_at: string
          id: string
          is_primary: boolean | null
          lead_id: string
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
          id?: string
          is_primary?: boolean | null
          lead_id: string
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
          id?: string
          is_primary?: boolean | null
          lead_id?: string
          state?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_addresses_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_checklist_items: {
        Row: {
          assigned_to: string | null
          checklist_id: string
          created_at: string
          due_date: string | null
          id: string
          is_checked: boolean
          position: number
          text: string
        }
        Insert: {
          assigned_to?: string | null
          checklist_id: string
          created_at?: string
          due_date?: string | null
          id?: string
          is_checked?: boolean
          position?: number
          text: string
        }
        Update: {
          assigned_to?: string | null
          checklist_id?: string
          created_at?: string
          due_date?: string | null
          id?: string
          is_checked?: boolean
          position?: number
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_checklist_items_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "lead_checklists"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_checklists: {
        Row: {
          activity_id: string | null
          created_at: string
          created_by: string | null
          id: string
          lead_id: string
          title: string
        }
        Insert: {
          activity_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id: string
          title?: string
        }
        Update: {
          activity_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_checklists_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "lead_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_checklists_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_connections: {
        Row: {
          connected_company: string | null
          connected_lead_id: string | null
          connected_name: string | null
          created_at: string
          id: string
          lead_id: string
          notes: string | null
          relationship_type: string | null
        }
        Insert: {
          connected_company?: string | null
          connected_lead_id?: string | null
          connected_name?: string | null
          created_at?: string
          id?: string
          lead_id: string
          notes?: string | null
          relationship_type?: string | null
        }
        Update: {
          connected_company?: string | null
          connected_lead_id?: string | null
          connected_name?: string | null
          created_at?: string
          id?: string
          lead_id?: string
          notes?: string | null
          relationship_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_connections_connected_lead_id_fkey"
            columns: ["connected_lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_connections_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_contacts: {
        Row: {
          created_at: string
          email: string | null
          id: string
          is_primary: boolean | null
          lead_id: string
          name: string
          notes: string | null
          phone: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean | null
          lead_id: string
          name: string
          notes?: string | null
          phone?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean | null
          lead_id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_contacts_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_emails: {
        Row: {
          created_at: string
          email: string
          email_type: string | null
          id: string
          is_primary: boolean | null
          lead_id: string
        }
        Insert: {
          created_at?: string
          email: string
          email_type?: string | null
          id?: string
          is_primary?: boolean | null
          lead_id: string
        }
        Update: {
          created_at?: string
          email?: string
          email_type?: string | null
          id?: string
          is_primary?: boolean | null
          lead_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_emails_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_files: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          lead_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          lead_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          lead_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_files_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_followers: {
        Row: {
          created_at: string | null
          id: string
          lead_id: string
          team_member_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          lead_id: string
          team_member_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          lead_id?: string
          team_member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_followers_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_followers_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_lender_programs: {
        Row: {
          created_at: string
          id: string
          lead_id: string
          notes: string | null
          program_id: string
          status: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          lead_id: string
          notes?: string | null
          program_id: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          lead_id?: string
          notes?: string | null
          program_id?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_lender_programs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_lender_programs_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "lender_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_other_contacts: {
        Row: {
          contact_type: string
          contact_value: string
          created_at: string
          id: string
          lead_id: string
        }
        Insert: {
          contact_type: string
          contact_value: string
          created_at?: string
          id?: string
          lead_id: string
        }
        Update: {
          contact_type?: string
          contact_value?: string
          created_at?: string
          id?: string
          lead_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_other_contacts_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_phones: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean | null
          lead_id: string
          phone_number: string
          phone_type: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean | null
          lead_id: string
          phone_number: string
          phone_type?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean | null
          lead_id?: string
          phone_number?: string
          phone_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_phones_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_projects: {
        Row: {
          bank_relationships: string | null
          clx_file_name: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          lead_id: string
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
          id?: string
          lead_id: string
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
          id?: string
          lead_id?: string
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
            foreignKeyName: "lead_projects_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_projects_owner_fkey"
            columns: ["owner"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_responses: {
        Row: {
          additional_information: string | null
          address_line_1: string | null
          address_line_2: string | null
          annual_revenue: string | null
          borrower_bankruptcy: string | null
          borrower_credit_score: string | null
          borrower_current_employer: string | null
          borrower_occupation: string | null
          borrower_year_started: string | null
          business_description: string | null
          business_type: string | null
          cash_out: string | null
          cash_out_amount: number | null
          city: string | null
          co_borrower_bankruptcy: string | null
          co_borrower_credit_score: string | null
          co_borrower_current_employer: string | null
          co_borrower_occupation: string | null
          co_borrower_year_started: string | null
          co_borrowers: string | null
          collateral_description: string | null
          collateral_value: number | null
          contact_method: string | null
          country: string | null
          created_at: string
          current_estimated_value: number | null
          current_lender: string | null
          current_loan_balance: number | null
          current_loan_in_default: string | null
          current_loan_maturity_date: string | null
          current_loan_rate: string | null
          desired_amortization: string | null
          desired_interest_rate: string | null
          desired_term: string | null
          email: string | null
          first_name: string | null
          funding_amount: string | null
          funding_purpose: string | null
          funding_timeline: string | null
          guarantors: string | null
          how_did_you_hear: string | null
          id: string
          last_name: string | null
          lead_id: string
          loan_amount: number | null
          loan_type: string | null
          loan_type_other: string | null
          newsletter_signup: boolean | null
          number_of_units: string | null
          phone: string | null
          principal_name: string | null
          property_owner_occupied: string | null
          purchase_price: number | null
          purpose_of_loan: string | null
          referred_by: string | null
          self_employed_business_type: string | null
          square_footage: string | null
          state: string | null
          submitted_at: string
          year_acquired: string | null
          year_business_founded: string | null
          zip_code: string | null
        }
        Insert: {
          additional_information?: string | null
          address_line_1?: string | null
          address_line_2?: string | null
          annual_revenue?: string | null
          borrower_bankruptcy?: string | null
          borrower_credit_score?: string | null
          borrower_current_employer?: string | null
          borrower_occupation?: string | null
          borrower_year_started?: string | null
          business_description?: string | null
          business_type?: string | null
          cash_out?: string | null
          cash_out_amount?: number | null
          city?: string | null
          co_borrower_bankruptcy?: string | null
          co_borrower_credit_score?: string | null
          co_borrower_current_employer?: string | null
          co_borrower_occupation?: string | null
          co_borrower_year_started?: string | null
          co_borrowers?: string | null
          collateral_description?: string | null
          collateral_value?: number | null
          contact_method?: string | null
          country?: string | null
          created_at?: string
          current_estimated_value?: number | null
          current_lender?: string | null
          current_loan_balance?: number | null
          current_loan_in_default?: string | null
          current_loan_maturity_date?: string | null
          current_loan_rate?: string | null
          desired_amortization?: string | null
          desired_interest_rate?: string | null
          desired_term?: string | null
          email?: string | null
          first_name?: string | null
          funding_amount?: string | null
          funding_purpose?: string | null
          funding_timeline?: string | null
          guarantors?: string | null
          how_did_you_hear?: string | null
          id?: string
          last_name?: string | null
          lead_id: string
          loan_amount?: number | null
          loan_type?: string | null
          loan_type_other?: string | null
          newsletter_signup?: boolean | null
          number_of_units?: string | null
          phone?: string | null
          principal_name?: string | null
          property_owner_occupied?: string | null
          purchase_price?: number | null
          purpose_of_loan?: string | null
          referred_by?: string | null
          self_employed_business_type?: string | null
          square_footage?: string | null
          state?: string | null
          submitted_at?: string
          year_acquired?: string | null
          year_business_founded?: string | null
          zip_code?: string | null
        }
        Update: {
          additional_information?: string | null
          address_line_1?: string | null
          address_line_2?: string | null
          annual_revenue?: string | null
          borrower_bankruptcy?: string | null
          borrower_credit_score?: string | null
          borrower_current_employer?: string | null
          borrower_occupation?: string | null
          borrower_year_started?: string | null
          business_description?: string | null
          business_type?: string | null
          cash_out?: string | null
          cash_out_amount?: number | null
          city?: string | null
          co_borrower_bankruptcy?: string | null
          co_borrower_credit_score?: string | null
          co_borrower_current_employer?: string | null
          co_borrower_occupation?: string | null
          co_borrower_year_started?: string | null
          co_borrowers?: string | null
          collateral_description?: string | null
          collateral_value?: number | null
          contact_method?: string | null
          country?: string | null
          created_at?: string
          current_estimated_value?: number | null
          current_lender?: string | null
          current_loan_balance?: number | null
          current_loan_in_default?: string | null
          current_loan_maturity_date?: string | null
          current_loan_rate?: string | null
          desired_amortization?: string | null
          desired_interest_rate?: string | null
          desired_term?: string | null
          email?: string | null
          first_name?: string | null
          funding_amount?: string | null
          funding_purpose?: string | null
          funding_timeline?: string | null
          guarantors?: string | null
          how_did_you_hear?: string | null
          id?: string
          last_name?: string | null
          lead_id?: string
          loan_amount?: number | null
          loan_type?: string | null
          loan_type_other?: string | null
          newsletter_signup?: boolean | null
          number_of_units?: string | null
          phone?: string | null
          principal_name?: string | null
          property_owner_occupied?: string | null
          purchase_price?: number | null
          purpose_of_loan?: string | null
          referred_by?: string | null
          self_employed_business_type?: string | null
          square_footage?: string | null
          state?: string | null
          submitted_at?: string
          year_acquired?: string | null
          year_business_founded?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_responses_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_signals: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          lead_id: string
          resolved_at: string | null
          severity: string
          signal_type: string
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          lead_id: string
          resolved_at?: string | null
          severity?: string
          signal_type: string
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          lead_id?: string
          resolved_at?: string | null
          severity?: string
          signal_type?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_signals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
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
          created_at: string
          deal_value: number | null
          description: string | null
          email: string | null
          fee_percent: number | null
          flagged_for_weekly: boolean
          history: string | null
          id: string
          initial_nudge_created_at: string | null
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
          name: string
          net_revenue: number | null
          next_action: string | null
          notes: string | null
          opportunity_name: string | null
          phone: string | null
          potential_revenue: number | null
          priority: string | null
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
          created_at?: string
          deal_value?: number | null
          description?: string | null
          email?: string | null
          fee_percent?: number | null
          flagged_for_weekly?: boolean
          history?: string | null
          id?: string
          initial_nudge_created_at?: string | null
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
          name: string
          net_revenue?: number | null
          next_action?: string | null
          notes?: string | null
          opportunity_name?: string | null
          phone?: string | null
          potential_revenue?: number | null
          priority?: string | null
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
          created_at?: string
          deal_value?: number | null
          description?: string | null
          email?: string | null
          fee_percent?: number | null
          flagged_for_weekly?: boolean
          history?: string | null
          id?: string
          initial_nudge_created_at?: string | null
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
          name?: string
          net_revenue?: number | null
          next_action?: string | null
          notes?: string | null
          opportunity_name?: string | null
          phone?: string | null
          potential_revenue?: number | null
          priority?: string | null
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
          work_website?: string | null
          wu_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_to_team_member_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      lender_programs: {
        Row: {
          call_status: string | null
          contact_name: string | null
          created_at: string
          description: string | null
          email: string | null
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
        Relationships: []
      }
      marketing_stats: {
        Row: {
          conversions: number | null
          created_at: string
          date: string
          id: string
          leads_count: number | null
          page_views: number | null
          source: string
        }
        Insert: {
          conversions?: number | null
          created_at?: string
          date: string
          id?: string
          leads_count?: number | null
          page_views?: number | null
          source: string
        }
        Update: {
          conversions?: number | null
          created_at?: string
          date?: string
          id?: string
          leads_count?: number | null
          page_views?: number | null
          source?: string
        }
        Relationships: []
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
      module_tasks: {
        Row: {
          created_at: string
          id: string
          module_id: string | null
          status: string
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          module_id?: string | null
          status?: string
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          module_id?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_tasks_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          business_owner: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
          portal: string | null
          priority: string
          status: string
          updated_at: string
        }
        Insert: {
          business_owner?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          portal?: string | null
          priority?: string
          status?: string
          updated_at?: string
        }
        Update: {
          business_owner?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          portal?: string | null
          priority?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      new_signups: {
        Row: {
          client_email: string | null
          client_name: string
          company_name: string | null
          created_at: string
          id: string
          notes: string | null
          signed_up_at: string
          source: string | null
        }
        Insert: {
          client_email?: string | null
          client_name: string
          company_name?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          signed_up_at?: string
          source?: string | null
        }
        Update: {
          client_email?: string | null
          client_name?: string
          company_name?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          signed_up_at?: string
          source?: string | null
        }
        Relationships: []
      }
      newsletter_campaign_events: {
        Row: {
          campaign_id: string
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          subscriber_id: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          subscriber_id: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          subscriber_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_campaign_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "newsletter_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_campaigns: {
        Row: {
          bounced_count: number | null
          clicked_count: number | null
          content: string | null
          created_at: string
          delivered_count: number | null
          id: string
          name: string
          opened_count: number | null
          recipients_count: number | null
          scheduled_for: string | null
          sent_at: string | null
          status: string
          subject: string
          template_id: string | null
          unsubscribed_count: number | null
          updated_at: string
        }
        Insert: {
          bounced_count?: number | null
          clicked_count?: number | null
          content?: string | null
          created_at?: string
          delivered_count?: number | null
          id?: string
          name: string
          opened_count?: number | null
          recipients_count?: number | null
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string
          subject: string
          template_id?: string | null
          unsubscribed_count?: number | null
          updated_at?: string
        }
        Update: {
          bounced_count?: number | null
          clicked_count?: number | null
          content?: string | null
          created_at?: string
          delivered_count?: number | null
          id?: string
          name?: string
          opened_count?: number | null
          recipients_count?: number | null
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
          template_id?: string | null
          unsubscribed_count?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_campaigns_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "newsletter_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_subscribers: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string | null
          source: string | null
          status: string
          subscribed_at: string
          unsubscribed_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name?: string | null
          source?: string | null
          status?: string
          subscribed_at?: string
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string | null
          source?: string | null
          status?: string
          subscribed_at?: string
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      newsletter_templates: {
        Row: {
          content: string
          created_at: string
          description: string | null
          id: string
          name: string
          subject: string | null
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          subject?: string | null
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          subject?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      notes: {
        Row: {
          content: string
          created_at: string
          id: string
          is_pinned: boolean
          team_member_id: string | null
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          team_member_id?: string | null
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          team_member_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      outbound_emails: {
        Row: {
          body_html: string
          body_plain: string
          created_at: string
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
          created_at?: string
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
          created_at?: string
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
        Relationships: [
          {
            foreignKeyName: "outbound_emails_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_commissions: {
        Row: {
          amount: number
          created_at: string
          id: string
          notes: string | null
          paid_at: string | null
          partner_id: string
          referral_id: string | null
          status: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          partner_id: string
          referral_id?: string | null
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          partner_id?: string
          referral_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_commissions_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "partner_referrals"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_referral_status_history: {
        Row: {
          changed_at: string
          id: string
          new_status: string
          note: string | null
          old_status: string | null
          referral_id: string
        }
        Insert: {
          changed_at?: string
          id?: string
          new_status: string
          note?: string | null
          old_status?: string | null
          referral_id: string
        }
        Update: {
          changed_at?: string
          id?: string
          new_status?: string
          note?: string | null
          old_status?: string | null
          referral_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_referral_status_history_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "partner_referrals"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_referrals: {
        Row: {
          company_name: string | null
          created_at: string
          email: string | null
          id: string
          lead_id: string | null
          loan_amount: number | null
          loan_type: string | null
          name: string
          notes: string | null
          partner_id: string
          phone: string | null
          property_address: string | null
          status: string
          updated_at: string
          urgency: string | null
        }
        Insert: {
          company_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          lead_id?: string | null
          loan_amount?: number | null
          loan_type?: string | null
          name: string
          notes?: string | null
          partner_id: string
          phone?: string | null
          property_address?: string | null
          status?: string
          updated_at?: string
          urgency?: string | null
        }
        Update: {
          company_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          lead_id?: string | null
          loan_amount?: number | null
          loan_type?: string | null
          name?: string
          notes?: string | null
          partner_id?: string
          phone?: string | null
          property_address?: string | null
          status?: string
          updated_at?: string
          urgency?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_referrals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_tracking: {
        Row: {
          created_at: string
          id: string
          internal_notes: string | null
          last_contacted_at: string | null
          next_follow_up: string | null
          partner_id: string
          priority: string
          referral_id: string
          tracking_status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          internal_notes?: string | null
          last_contacted_at?: string | null
          next_follow_up?: string | null
          partner_id: string
          priority?: string
          referral_id: string
          tracking_status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          internal_notes?: string | null
          last_contacted_at?: string | null
          next_follow_up?: string | null
          partner_id?: string
          priority?: string
          referral_id?: string
          tracking_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_tracking_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "partner_referrals"
            referencedColumns: ["id"]
          },
        ]
      }
      people_addresses: {
        Row: {
          address_line_1: string | null
          address_line_2: string | null
          address_type: string | null
          city: string | null
          country: string | null
          created_at: string
          id: string
          is_primary: boolean | null
          person_id: string
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
          id?: string
          is_primary?: boolean | null
          person_id: string
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
          id?: string
          is_primary?: boolean | null
          person_id?: string
          state?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      people_emails: {
        Row: {
          created_at: string
          email: string
          email_type: string | null
          id: string
          is_primary: boolean | null
          person_id: string
        }
        Insert: {
          created_at?: string
          email: string
          email_type?: string | null
          id?: string
          is_primary?: boolean | null
          person_id: string
        }
        Update: {
          created_at?: string
          email?: string
          email_type?: string | null
          id?: string
          is_primary?: boolean | null
          person_id?: string
        }
        Relationships: []
      }
      people_phones: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean | null
          person_id: string
          phone_number: string
          phone_type: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean | null
          person_id: string
          phone_number: string
          phone_type?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean | null
          person_id?: string
          phone_number?: string
          phone_type?: string | null
        }
        Relationships: []
      }
      pipeline_column_values: {
        Row: {
          assigned_to_id: string | null
          boolean_value: boolean | null
          column_id: string
          contact_value: Json | null
          created_at: string
          date_value: string | null
          dropdown_value: string | null
          id: string
          lead_id: string
          number_value: number | null
          tag_values: string[] | null
          text_value: string | null
          updated_at: string
        }
        Insert: {
          assigned_to_id?: string | null
          boolean_value?: boolean | null
          column_id: string
          contact_value?: Json | null
          created_at?: string
          date_value?: string | null
          dropdown_value?: string | null
          id?: string
          lead_id: string
          number_value?: number | null
          tag_values?: string[] | null
          text_value?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to_id?: string | null
          boolean_value?: boolean | null
          column_id?: string
          contact_value?: Json | null
          created_at?: string
          date_value?: string | null
          dropdown_value?: string | null
          id?: string
          lead_id?: string
          number_value?: number | null
          tag_values?: string[] | null
          text_value?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_column_values_assigned_to_id_fkey"
            columns: ["assigned_to_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_column_values_column_id_fkey"
            columns: ["column_id"]
            isOneToOne: false
            referencedRelation: "pipeline_columns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_column_values_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_columns: {
        Row: {
          column_type: Database["public"]["Enums"]["pipeline_column_type"]
          created_at: string
          formula: string | null
          id: string
          is_frozen: boolean
          is_visible: boolean
          name: string
          options: Json | null
          pipeline_id: string
          position: number
          settings: Json | null
          updated_at: string
        }
        Insert: {
          column_type?: Database["public"]["Enums"]["pipeline_column_type"]
          created_at?: string
          formula?: string | null
          id?: string
          is_frozen?: boolean
          is_visible?: boolean
          name: string
          options?: Json | null
          pipeline_id: string
          position?: number
          settings?: Json | null
          updated_at?: string
        }
        Update: {
          column_type?: Database["public"]["Enums"]["pipeline_column_type"]
          created_at?: string
          formula?: string | null
          id?: string
          is_frozen?: boolean
          is_visible?: boolean
          name?: string
          options?: Json | null
          pipeline_id?: string
          position?: number
          settings?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_columns_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_leads: {
        Row: {
          added_at: string
          id: string
          lead_id: string
          pipeline_id: string
          stage_id: string
          updated_at: string
        }
        Insert: {
          added_at?: string
          id?: string
          lead_id: string
          pipeline_id: string
          stage_id: string
          updated_at?: string
        }
        Update: {
          added_at?: string
          id?: string
          lead_id?: string
          pipeline_id?: string
          stage_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_leads_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_leads_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_leads_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
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
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_shares_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_shares_shared_with_id_fkey"
            columns: ["shared_with_id"]
            isOneToOne: false
            referencedRelation: "team_members"
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
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          city: string | null
          company_name: string | null
          contact_person: string | null
          created_at: string
          email: string | null
          id: string
          notes: string | null
          phone: string | null
          state: string | null
          updated_at: string
          user_id: string
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          company_name?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string
          user_id: string
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          company_name?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string
          user_id?: string
          zip_code?: string | null
        }
        Relationships: []
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
            referencedRelation: "leads"
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
        Relationships: [
          {
            foreignKeyName: "ratewatch_questionnaire_responses_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
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
      sheets_connections: {
        Row: {
          access_token: string
          created_at: string
          email: string
          id: string
          refresh_token: string
          team_member_name: string | null
          token_expiry: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          email: string
          id?: string
          refresh_token: string
          team_member_name?: string | null
          token_expiry: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          email?: string
          id?: string
          refresh_token?: string
          team_member_name?: string | null
          token_expiry?: string
          updated_at?: string
          user_id?: string
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
          team_member_id: string | null
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
          team_member_id?: string | null
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
          team_member_id?: string | null
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
            foreignKeyName: "task_activities_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      task_files: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          task_id: string
          team_member_id: string | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          task_id: string
          team_member_id?: string | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          task_id?: string
          team_member_id?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evan_task_files_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_files_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          estimated_hours: number | null
          group_name: string | null
          id: string
          is_completed: boolean
          lead_id: string | null
          priority: string | null
          source: string | null
          status: string | null
          tags: string[] | null
          task_type: string | null
          team_member_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          group_name?: string | null
          id?: string
          is_completed?: boolean
          lead_id?: string | null
          priority?: string | null
          source?: string | null
          status?: string | null
          tags?: string[] | null
          task_type?: string | null
          team_member_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          group_name?: string | null
          id?: string
          is_completed?: boolean
          lead_id?: string | null
          priority?: string | null
          source?: string | null
          status?: string | null
          tags?: string[] | null
          task_type?: string | null
          team_member_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evan_tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      team_funded_deals: {
        Row: {
          created_at: string
          days_in_pipeline: number
          fee_earned: number
          funded_at: string
          id: string
          lead_id: string | null
          loan_amount: number
          notes: string | null
          team_member_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          days_in_pipeline?: number
          fee_earned?: number
          funded_at?: string
          id?: string
          lead_id?: string | null
          loan_amount?: number
          notes?: string | null
          team_member_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          days_in_pipeline?: number
          fee_earned?: number
          funded_at?: string
          id?: string
          lead_id?: string | null
          loan_amount?: number
          notes?: string | null
          team_member_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_funded_deals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_funded_deals_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          is_owner: boolean | null
          name: string
          phone: string | null
          role: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          is_owner?: boolean | null
          name: string
          phone?: string | null
          role?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          is_owner?: boolean | null
          name?: string
          phone?: string | null
          role?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      team_monthly_goals: {
        Row: {
          created_at: string | null
          current_value: number
          goal_label: string
          id: string
          target_value: number
          team_member_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          current_value?: number
          goal_label: string
          id?: string
          target_value?: number
          team_member_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          current_value?: number
          goal_label?: string
          id?: string
          target_value?: number
          team_member_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_monthly_goals_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
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
      get_current_team_member: {
        Args: never
        Returns: {
          email: string
          id: string
          is_owner: boolean
          name: string
          role: string
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
    }
    Enums: {
      app_role: "admin" | "client" | "partner" | "super_admin"
      contract_status:
        | "draft"
        | "sent"
        | "viewed"
        | "signed"
        | "expired"
        | "cancelled"
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
      app_role: ["admin", "client", "partner", "super_admin"],
      contract_status: [
        "draft",
        "sent",
        "viewed",
        "signed",
        "expired",
        "cancelled",
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
    },
  },
} as const
