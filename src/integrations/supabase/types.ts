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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      announcements: {
        Row: {
          audience: string | null
          created_at: string | null
          id: string
          message: string | null
          posted_on: string | null
          read_count: number | null
          title: string
          updated_at: string | null
        }
        Insert: {
          audience?: string | null
          created_at?: string | null
          id?: string
          message?: string | null
          posted_on?: string | null
          read_count?: number | null
          title: string
          updated_at?: string | null
        }
        Update: {
          audience?: string | null
          created_at?: string | null
          id?: string
          message?: string | null
          posted_on?: string | null
          read_count?: number | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      asset_assignments: {
        Row: {
          asset_id: string | null
          assigned_on: string | null
          condition: string | null
          created_at: string | null
          employee_id: string | null
          id: string
          notes: string | null
          returned_on: string | null
          updated_at: string | null
        }
        Insert: {
          asset_id?: string | null
          assigned_on?: string | null
          condition?: string | null
          created_at?: string | null
          employee_id?: string | null
          id?: string
          notes?: string | null
          returned_on?: string | null
          updated_at?: string | null
        }
        Update: {
          asset_id?: string | null
          assigned_on?: string | null
          condition?: string | null
          created_at?: string | null
          employee_id?: string | null
          id?: string
          notes?: string | null
          returned_on?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_assignments_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_handover_requests: {
        Row: {
          approved_by: string | null
          asset_id: string
          comments: string | null
          created_at: string | null
          from_employee_id: string
          id: string
          requested_on: string
          status: Database["public"]["Enums"]["handover_status"]
          to_employee_id: string | null
          updated_at: string | null
        }
        Insert: {
          approved_by?: string | null
          asset_id: string
          comments?: string | null
          created_at?: string | null
          from_employee_id: string
          id?: string
          requested_on?: string
          status?: Database["public"]["Enums"]["handover_status"]
          to_employee_id?: string | null
          updated_at?: string | null
        }
        Update: {
          approved_by?: string | null
          asset_id?: string
          comments?: string | null
          created_at?: string | null
          from_employee_id?: string
          id?: string
          requested_on?: string
          status?: Database["public"]["Enums"]["handover_status"]
          to_employee_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_handover_requests_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_handover_requests_from_employee_id_fkey"
            columns: ["from_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_handover_requests_to_employee_id_fkey"
            columns: ["to_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          asset_code: string
          created_at: string | null
          id: string
          model: string | null
          purchase_date: string | null
          serial: string | null
          status: Database["public"]["Enums"]["asset_status"] | null
          type: string | null
          updated_at: string | null
          warranty_till: string | null
        }
        Insert: {
          asset_code: string
          created_at?: string | null
          id?: string
          model?: string | null
          purchase_date?: string | null
          serial?: string | null
          status?: Database["public"]["Enums"]["asset_status"] | null
          type?: string | null
          updated_at?: string | null
          warranty_till?: string | null
        }
        Update: {
          asset_code?: string
          created_at?: string | null
          id?: string
          model?: string | null
          purchase_date?: string | null
          serial?: string | null
          status?: Database["public"]["Enums"]["asset_status"] | null
          type?: string | null
          updated_at?: string | null
          warranty_till?: string | null
        }
        Relationships: []
      }
      attendance_status: {
        Row: {
          created_at: string | null
          date: string
          employee_id: string
          id: string
          remarks: string | null
          source: Database["public"]["Enums"]["attendance_source"] | null
          status: Database["public"]["Enums"]["attendance_status_enum"]
          updated_at: string | null
          work_hours: number | null
        }
        Insert: {
          created_at?: string | null
          date: string
          employee_id: string
          id?: string
          remarks?: string | null
          source?: Database["public"]["Enums"]["attendance_source"] | null
          status: Database["public"]["Enums"]["attendance_status_enum"]
          updated_at?: string | null
          work_hours?: number | null
        }
        Update: {
          created_at?: string | null
          date?: string
          employee_id?: string
          id?: string
          remarks?: string | null
          source?: Database["public"]["Enums"]["attendance_source"] | null
          status?: Database["public"]["Enums"]["attendance_status_enum"]
          updated_at?: string | null
          work_hours?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_status_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_upload: {
        Row: {
          created_at: string | null
          date: string
          device_id: string | null
          emp_code: string
          first_swipe: string | null
          id: string
          last_swipe: string | null
          location: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          date: string
          device_id?: string | null
          emp_code: string
          first_swipe?: string | null
          id?: string
          last_swipe?: string | null
          location?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          date?: string
          device_id?: string | null
          emp_code?: string
          first_swipe?: string | null
          id?: string
          last_swipe?: string | null
          location?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      employees: {
        Row: {
          aadhaar_number: string | null
          alt_phone: string | null
          bank_account_name: string | null
          bank_account_number: string | null
          bank_branch: string | null
          bank_ifsc: string | null
          blood_group: string | null
          brand: string | null
          created_at: string | null
          current_address: string | null
          department: string | null
          designation: string | null
          dob: string | null
          doj: string | null
          email: string
          emergency_contact_name: string | null
          emergency_phone: string | null
          emp_code: string
          facebook: string | null
          father_name: string | null
          first_name: string
          gender: string | null
          highlights_cache: Json | null
          hike_cycle_months: number | null
          hobbies_interests: string | null
          id: string
          instagram: string | null
          languages_known: string | null
          last_hike_amount: number | null
          last_hike_on: string | null
          last_hike_pct: number | null
          last_name: string | null
          linkedin: string | null
          location: string | null
          manager_employee_id: string | null
          marital_status: string | null
          monthly_ctc: number | null
          mother_name: string | null
          open_box_notes: string | null
          other_social: string | null
          pan_number: string | null
          passport_photo_url: string | null
          permanent_address: string | null
          personal_vision: string | null
          pf_applicable: boolean | null
          pf_portal_pass: string | null
          pf_portal_user: string | null
          phone: string | null
          photo_url: string | null
          pt_state: Database["public"]["Enums"]["pt_state"] | null
          qualification: string | null
          qualification_proof_url: string | null
          regular_photo_url: string | null
          status: Database["public"]["Enums"]["employee_status"] | null
          tshirt_size: string | null
          twitter: string | null
          updated_at: string | null
          upi_id: string | null
          user_id: string | null
          whatsapp_number: string | null
        }
        Insert: {
          aadhaar_number?: string | null
          alt_phone?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_branch?: string | null
          bank_ifsc?: string | null
          blood_group?: string | null
          brand?: string | null
          created_at?: string | null
          current_address?: string | null
          department?: string | null
          designation?: string | null
          dob?: string | null
          doj?: string | null
          email: string
          emergency_contact_name?: string | null
          emergency_phone?: string | null
          emp_code: string
          facebook?: string | null
          father_name?: string | null
          first_name: string
          gender?: string | null
          highlights_cache?: Json | null
          hike_cycle_months?: number | null
          hobbies_interests?: string | null
          id?: string
          instagram?: string | null
          languages_known?: string | null
          last_hike_amount?: number | null
          last_hike_on?: string | null
          last_hike_pct?: number | null
          last_name?: string | null
          linkedin?: string | null
          location?: string | null
          manager_employee_id?: string | null
          marital_status?: string | null
          monthly_ctc?: number | null
          mother_name?: string | null
          open_box_notes?: string | null
          other_social?: string | null
          pan_number?: string | null
          passport_photo_url?: string | null
          permanent_address?: string | null
          personal_vision?: string | null
          pf_applicable?: boolean | null
          pf_portal_pass?: string | null
          pf_portal_user?: string | null
          phone?: string | null
          photo_url?: string | null
          pt_state?: Database["public"]["Enums"]["pt_state"] | null
          qualification?: string | null
          qualification_proof_url?: string | null
          regular_photo_url?: string | null
          status?: Database["public"]["Enums"]["employee_status"] | null
          tshirt_size?: string | null
          twitter?: string | null
          updated_at?: string | null
          upi_id?: string | null
          user_id?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          aadhaar_number?: string | null
          alt_phone?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_branch?: string | null
          bank_ifsc?: string | null
          blood_group?: string | null
          brand?: string | null
          created_at?: string | null
          current_address?: string | null
          department?: string | null
          designation?: string | null
          dob?: string | null
          doj?: string | null
          email?: string
          emergency_contact_name?: string | null
          emergency_phone?: string | null
          emp_code?: string
          facebook?: string | null
          father_name?: string | null
          first_name?: string
          gender?: string | null
          highlights_cache?: Json | null
          hike_cycle_months?: number | null
          hobbies_interests?: string | null
          id?: string
          instagram?: string | null
          languages_known?: string | null
          last_hike_amount?: number | null
          last_hike_on?: string | null
          last_hike_pct?: number | null
          last_name?: string | null
          linkedin?: string | null
          location?: string | null
          manager_employee_id?: string | null
          marital_status?: string | null
          monthly_ctc?: number | null
          mother_name?: string | null
          open_box_notes?: string | null
          other_social?: string | null
          pan_number?: string | null
          passport_photo_url?: string | null
          permanent_address?: string | null
          personal_vision?: string | null
          pf_applicable?: boolean | null
          pf_portal_pass?: string | null
          pf_portal_user?: string | null
          phone?: string | null
          photo_url?: string | null
          pt_state?: Database["public"]["Enums"]["pt_state"] | null
          qualification?: string | null
          qualification_proof_url?: string | null
          regular_photo_url?: string | null
          status?: Database["public"]["Enums"]["employee_status"] | null
          tshirt_size?: string | null
          twitter?: string | null
          updated_at?: string | null
          upi_id?: string | null
          user_id?: string | null
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_manager_employee_id_fkey"
            columns: ["manager_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      hikes: {
        Row: {
          amount: number | null
          created_at: string | null
          date: string
          employee_id: string
          id: string
          note: string | null
          pct: number | null
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          date: string
          employee_id: string
          id?: string
          note?: string | null
          pct?: number | null
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          date?: string
          employee_id?: string
          id?: string
          note?: string | null
          pct?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hikes_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      insurance_policies: {
        Row: {
          card_image_url: string | null
          created_at: string | null
          employee_id: string
          end_date: string | null
          id: string
          insurer_logo_url: string | null
          insurer_name: string | null
          notes: string | null
          policy_number: string | null
          product_name: string | null
          start_date: string | null
          updated_at: string | null
        }
        Insert: {
          card_image_url?: string | null
          created_at?: string | null
          employee_id: string
          end_date?: string | null
          id?: string
          insurer_logo_url?: string | null
          insurer_name?: string | null
          notes?: string | null
          policy_number?: string | null
          product_name?: string | null
          start_date?: string | null
          updated_at?: string | null
        }
        Update: {
          card_image_url?: string | null
          created_at?: string | null
          employee_id?: string
          end_date?: string | null
          id?: string
          insurer_logo_url?: string | null
          insurer_name?: string | null
          notes?: string | null
          policy_number?: string | null
          product_name?: string | null
          start_date?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "insurance_policies_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          approver_user_id: string | null
          attachment_url: string | null
          created_at: string | null
          created_on: string | null
          days: number | null
          employee_id: string
          end_date: string | null
          id: string
          priority_score: number | null
          raw_text: string | null
          reason: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["leave_status"] | null
          type: Database["public"]["Enums"]["leave_type"] | null
          updated_at: string | null
        }
        Insert: {
          approver_user_id?: string | null
          attachment_url?: string | null
          created_at?: string | null
          created_on?: string | null
          days?: number | null
          employee_id: string
          end_date?: string | null
          id?: string
          priority_score?: number | null
          raw_text?: string | null
          reason?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["leave_status"] | null
          type?: Database["public"]["Enums"]["leave_type"] | null
          updated_at?: string | null
        }
        Update: {
          approver_user_id?: string | null
          attachment_url?: string | null
          created_at?: string | null
          created_on?: string | null
          days?: number | null
          employee_id?: string
          end_date?: string | null
          id?: string
          priority_score?: number | null
          raw_text?: string | null
          reason?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["leave_status"] | null
          type?: Database["public"]["Enums"]["leave_type"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      messages_log: {
        Row: {
          body: string | null
          channel: Database["public"]["Enums"]["message_channel"]
          created_at: string | null
          created_by: string
          created_on: string
          employee_id: string
          id: string
          subject: string | null
          updated_at: string | null
        }
        Insert: {
          body?: string | null
          channel: Database["public"]["Enums"]["message_channel"]
          created_at?: string | null
          created_by: string
          created_on?: string
          employee_id: string
          id?: string
          subject?: string | null
          updated_at?: string | null
        }
        Update: {
          body?: string | null
          channel?: Database["public"]["Enums"]["message_channel"]
          created_at?: string | null
          created_by?: string
          created_on?: string
          employee_id?: string
          id?: string
          subject?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_log_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          attachments: string[] | null
          candidate_email: string
          candidate_name: string
          candidate_phone: string | null
          created_at: string | null
          ctc: string | null
          dept: string | null
          id: string
          job_title: string
          joining_date: string | null
          location: string | null
          offer_html: string | null
          public_token: string | null
          recruiter_user_id: string | null
          remarks: string | null
          signed_at: string | null
          status: Database["public"]["Enums"]["offer_status"] | null
          updated_at: string | null
        }
        Insert: {
          attachments?: string[] | null
          candidate_email: string
          candidate_name: string
          candidate_phone?: string | null
          created_at?: string | null
          ctc?: string | null
          dept?: string | null
          id?: string
          job_title: string
          joining_date?: string | null
          location?: string | null
          offer_html?: string | null
          public_token?: string | null
          recruiter_user_id?: string | null
          remarks?: string | null
          signed_at?: string | null
          status?: Database["public"]["Enums"]["offer_status"] | null
          updated_at?: string | null
        }
        Update: {
          attachments?: string[] | null
          candidate_email?: string
          candidate_name?: string
          candidate_phone?: string | null
          created_at?: string | null
          ctc?: string | null
          dept?: string | null
          id?: string
          job_title?: string
          joining_date?: string | null
          location?: string | null
          offer_html?: string | null
          public_token?: string | null
          recruiter_user_id?: string | null
          remarks?: string | null
          signed_at?: string | null
          status?: Database["public"]["Enums"]["offer_status"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      payroll_items: {
        Row: {
          breakup_json: Json | null
          created_at: string | null
          deductions: number | null
          employee_id: string
          evidence_url: string | null
          gross: number | null
          id: string
          lop_days: number | null
          net: number | null
          paid: boolean | null
          paid_at: string | null
          payslip_url: string | null
          remarks: string | null
          run_id: string
          updated_at: string | null
        }
        Insert: {
          breakup_json?: Json | null
          created_at?: string | null
          deductions?: number | null
          employee_id: string
          evidence_url?: string | null
          gross?: number | null
          id?: string
          lop_days?: number | null
          net?: number | null
          paid?: boolean | null
          paid_at?: string | null
          payslip_url?: string | null
          remarks?: string | null
          run_id: string
          updated_at?: string | null
        }
        Update: {
          breakup_json?: Json | null
          created_at?: string | null
          deductions?: number | null
          employee_id?: string
          evidence_url?: string | null
          gross?: number | null
          id?: string
          lop_days?: number | null
          net?: number | null
          paid?: boolean | null
          paid_at?: string | null
          payslip_url?: string | null
          remarks?: string | null
          run_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_items_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_items_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["run_id"]
          },
        ]
      }
      payroll_runs: {
        Row: {
          created_at: string | null
          created_on: string | null
          id: string
          month: number | null
          notes: string | null
          run_id: string
          status: Database["public"]["Enums"]["payroll_status"] | null
          updated_at: string | null
          year: number | null
        }
        Insert: {
          created_at?: string | null
          created_on?: string | null
          id?: string
          month?: number | null
          notes?: string | null
          run_id: string
          status?: Database["public"]["Enums"]["payroll_status"] | null
          updated_at?: string | null
          year?: number | null
        }
        Update: {
          created_at?: string | null
          created_on?: string | null
          id?: string
          month?: number | null
          notes?: string | null
          run_id?: string
          status?: Database["public"]["Enums"]["payroll_status"] | null
          updated_at?: string | null
          year?: number | null
        }
        Relationships: []
      }
      payslips: {
        Row: {
          created_at: string | null
          deductions: number | null
          employee_id: string
          gross: number | null
          id: string
          month: number
          net: number | null
          pdf_url: string | null
          remarks: string | null
          run_id: string | null
          updated_at: string | null
          visible_to_employee: boolean
          year: number
        }
        Insert: {
          created_at?: string | null
          deductions?: number | null
          employee_id: string
          gross?: number | null
          id?: string
          month: number
          net?: number | null
          pdf_url?: string | null
          remarks?: string | null
          run_id?: string | null
          updated_at?: string | null
          visible_to_employee?: boolean
          year: number
        }
        Update: {
          created_at?: string | null
          deductions?: number | null
          employee_id?: string
          gross?: number | null
          id?: string
          month?: number
          net?: number | null
          pdf_url?: string | null
          remarks?: string | null
          run_id?: string | null
          updated_at?: string | null
          visible_to_employee?: boolean
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "payslips_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders: {
        Row: {
          channel: Database["public"]["Enums"]["reminder_channel"] | null
          created_at: string | null
          done_on: string | null
          due_date: string | null
          due_time: string | null
          employee_id: string | null
          evidence_url: string | null
          id: string
          status: Database["public"]["Enums"]["reminder_status"] | null
          template: string | null
          title: string | null
          type: Database["public"]["Enums"]["reminder_type"] | null
          updated_at: string | null
        }
        Insert: {
          channel?: Database["public"]["Enums"]["reminder_channel"] | null
          created_at?: string | null
          done_on?: string | null
          due_date?: string | null
          due_time?: string | null
          employee_id?: string | null
          evidence_url?: string | null
          id?: string
          status?: Database["public"]["Enums"]["reminder_status"] | null
          template?: string | null
          title?: string | null
          type?: Database["public"]["Enums"]["reminder_type"] | null
          updated_at?: string | null
        }
        Update: {
          channel?: Database["public"]["Enums"]["reminder_channel"] | null
          created_at?: string | null
          done_on?: string | null
          due_date?: string | null
          due_time?: string | null
          employee_id?: string | null
          evidence_url?: string | null
          id?: string
          status?: Database["public"]["Enums"]["reminder_status"] | null
          template?: string | null
          title?: string | null
          type?: Database["public"]["Enums"]["reminder_type"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reminders_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      sticky_notes: {
        Row: {
          created_at: string | null
          expires_on: string | null
          id: string
          linked_departments: string | null
          note: string | null
          pinned: boolean | null
          tags: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          expires_on?: string | null
          id?: string
          linked_departments?: string | null
          note?: string | null
          pinned?: boolean | null
          tags?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          expires_on?: string | null
          id?: string
          linked_departments?: string | null
          note?: string | null
          pinned?: boolean | null
          tags?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_secure_token: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_user_role_priority: {
        Args: { _user_id: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      setup_master_admin: {
        Args: { admin_email: string }
        Returns: string
      }
      setup_raj_admin: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
    }
    Enums: {
      app_role: "super_admin" | "hr" | "employee"
      asset_status: "InUse" | "Idle" | "Repair" | "Retired"
      attendance_source: "device" | "leave" | "override" | "none"
      attendance_status_enum: "P" | "A" | "HD" | "L" | "OD" | "WFH"
      employee_status: "Active" | "Inactive"
      handover_status: "Requested" | "Approved" | "Rejected" | "Completed"
      leave_status: "Pending" | "Approved" | "Rejected"
      leave_type: "SL" | "CL" | "EL" | "LOP"
      message_channel: "Email" | "WhatsApp"
      offer_status: "Draft" | "Sent" | "Accepted" | "Declined" | "Withdrawn"
      payroll_status: "Draft" | "Computed" | "Approved" | "Locked"
      pt_state: "TS" | "AP"
      reminder_channel: "Email" | "WhatsApp" | "Both"
      reminder_status: "Open" | "Done"
      reminder_type: "Birthday" | "Anniversary" | "Hike" | "Doc" | "Custom"
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
      app_role: ["super_admin", "hr", "employee"],
      asset_status: ["InUse", "Idle", "Repair", "Retired"],
      attendance_source: ["device", "leave", "override", "none"],
      attendance_status_enum: ["P", "A", "HD", "L", "OD", "WFH"],
      employee_status: ["Active", "Inactive"],
      handover_status: ["Requested", "Approved", "Rejected", "Completed"],
      leave_status: ["Pending", "Approved", "Rejected"],
      leave_type: ["SL", "CL", "EL", "LOP"],
      message_channel: ["Email", "WhatsApp"],
      offer_status: ["Draft", "Sent", "Accepted", "Declined", "Withdrawn"],
      payroll_status: ["Draft", "Computed", "Approved", "Locked"],
      pt_state: ["TS", "AP"],
      reminder_channel: ["Email", "WhatsApp", "Both"],
      reminder_status: ["Open", "Done"],
      reminder_type: ["Birthday", "Anniversary", "Hike", "Doc", "Custom"],
    },
  },
} as const
