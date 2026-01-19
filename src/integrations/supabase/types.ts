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
          call_sid: string
          created_at: string
          direction: string
          ended_at: string | null
          from_number: string
          id: string
          lead_id: string | null
          status: string
          to_number: string
          updated_at: string
        }
        Insert: {
          answered_at?: string | null
          call_sid: string
          created_at?: string
          direction?: string
          ended_at?: string | null
          from_number: string
          id?: string
          lead_id?: string | null
          status?: string
          to_number: string
          updated_at?: string
        }
        Update: {
          answered_at?: string | null
          call_sid?: string
          created_at?: string
          direction?: string
          ended_at?: string | null
          from_number?: string
          id?: string
          lead_id?: string | null
          status?: string
          to_number?: string
          updated_at?: string
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
      calendar_connections: {
        Row: {
          access_token: string
          calendar_id: string | null
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
          calendar_id?: string | null
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
          calendar_id?: string | null
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
      evan_appointments: {
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
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evan_appointments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      evan_communications: {
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
          transcript?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evan_communications_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      evan_notes: {
        Row: {
          content: string
          created_at: string
          id: string
          is_pinned: boolean
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      evan_tasks: {
        Row: {
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          is_completed: boolean
          priority: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          is_completed?: boolean
          priority?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          is_completed?: boolean
          priority?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
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
      leads: {
        Row: {
          assigned_to: string | null
          company_name: string | null
          converted_at: string | null
          converted_to_client_id: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          qualified_at: string | null
          questionnaire_completed_at: string | null
          questionnaire_sent_at: string | null
          questionnaire_token: string | null
          source: string | null
          status: Database["public"]["Enums"]["lead_status"]
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          company_name?: string | null
          converted_at?: string | null
          converted_to_client_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          qualified_at?: string | null
          questionnaire_completed_at?: string | null
          questionnaire_sent_at?: string | null
          questionnaire_token?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          company_name?: string | null
          converted_at?: string | null
          converted_to_client_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          qualified_at?: string | null
          questionnaire_completed_at?: string | null
          questionnaire_sent_at?: string | null
          questionnaire_token?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
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
          created_at: string
          description: string | null
          id: string
          interest_range: string | null
          lender_name: string
          lender_specialty: string | null
          max_loan: number | null
          min_loan: number | null
          program_name: string
          program_type: string
          term: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          interest_range?: string | null
          lender_name: string
          lender_specialty?: string | null
          max_loan?: number | null
          min_loan?: number | null
          program_name: string
          program_type: string
          term?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          interest_range?: string | null
          lender_name?: string
          lender_specialty?: string | null
          max_loan?: number | null
          min_loan?: number | null
          program_name?: string
          program_type?: string
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
      rate_watch: {
        Row: {
          created_at: string
          current_rate: number
          enrolled_at: string
          id: string
          is_active: boolean
          last_contacted_at: string | null
          lead_id: string
          loan_amount: number | null
          loan_type: string | null
          notes: string | null
          target_rate: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_rate: number
          enrolled_at?: string
          id?: string
          is_active?: boolean
          last_contacted_at?: string | null
          lead_id: string
          loan_amount?: number | null
          loan_type?: string | null
          notes?: string | null
          target_rate: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_rate?: number
          enrolled_at?: string
          id?: string
          is_active?: boolean
          last_contacted_at?: string | null
          lead_id?: string
          loan_amount?: number | null
          loan_type?: string | null
          notes?: string | null
          target_rate?: number
          updated_at?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_team_member: {
        Args: { _team_member_name: string }
        Returns: boolean
      }
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
      app_role: "admin" | "client"
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
      app_role: ["admin", "client"],
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
      ],
    },
  },
} as const
