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
      budget_categories: {
        Row: {
          actual_amount: number
          applied_source: string
          category_code: string
          created_at: string
          enabled: boolean
          id: string
          personalized_amount: number | null
          planned_amount: number
          prepared_amount: number
          recommended_amount: number
          sort_order: number
          trip_budget_id: string
          updated_at: string
        }
        Insert: {
          actual_amount?: number
          applied_source?: string
          category_code: string
          created_at?: string
          enabled?: boolean
          id?: string
          personalized_amount?: number | null
          planned_amount?: number
          prepared_amount?: number
          recommended_amount?: number
          sort_order?: number
          trip_budget_id: string
          updated_at?: string
        }
        Update: {
          actual_amount?: number
          applied_source?: string
          category_code?: string
          created_at?: string
          enabled?: boolean
          id?: string
          personalized_amount?: number | null
          planned_amount?: number
          prepared_amount?: number
          recommended_amount?: number
          sort_order?: number
          trip_budget_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_categories_trip_budget_id_fkey"
            columns: ["trip_budget_id"]
            isOneToOne: false
            referencedRelation: "trip_budgets"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_plan_items: {
        Row: {
          actual_amount: number
          budget_category_id: string
          created_at: string
          display_mode: string
          expected_amount: number
          id: string
          name: string
          sort_order: number
          status: string
          updated_at: string
        }
        Insert: {
          actual_amount?: number
          budget_category_id: string
          created_at?: string
          display_mode?: string
          expected_amount?: number
          id?: string
          name: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Update: {
          actual_amount?: number
          budget_category_id?: string
          created_at?: string
          display_mode?: string
          expected_amount?: number
          id?: string
          name?: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_plan_items_budget_category_id_fkey"
            columns: ["budget_category_id"]
            isOneToOne: false
            referencedRelation: "budget_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          author_user_id: string | null
          content: string
          created_at: string
          id: string
          post_id: string
          status: string
          updated_at: string
        }
        Insert: {
          author_user_id?: string | null
          content: string
          created_at?: string
          id?: string
          post_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          author_user_id?: string | null
          content?: string
          created_at?: string
          id?: string
          post_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_user_id_fkey"
            columns: ["author_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_posts: {
        Row: {
          author_user_id: string | null
          content: string | null
          created_at: string
          destination: string | null
          id: string
          image_urls: string[]
          post_type: string
          published_at: string | null
          status: string
          title: string
          trip_id: string | null
          updated_at: string
        }
        Insert: {
          author_user_id?: string | null
          content?: string | null
          created_at?: string
          destination?: string | null
          id?: string
          image_urls?: string[]
          post_type?: string
          published_at?: string | null
          status?: string
          title: string
          trip_id?: string | null
          updated_at?: string
        }
        Update: {
          author_user_id?: string | null
          content?: string | null
          created_at?: string
          destination?: string | null
          id?: string
          image_urls?: string[]
          post_type?: string
          published_at?: string | null
          status?: string
          title?: string
          trip_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_posts_author_user_id_fkey"
            columns: ["author_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_posts_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      contributions: {
        Row: {
          created_at: string
          expected_amount: number
          id: string
          paid_amount: number
          source_type: string
          status: string
          trip_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          expected_amount?: number
          id?: string
          paid_amount?: number
          source_type?: string
          status?: string
          trip_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          expected_amount?: number
          id?: string
          paid_amount?: number
          source_type?: string
          status?: string
          trip_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contributions_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contributions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      destination_budget_products: {
        Row: {
          destination_key: string
          emoji: string
          generated_at: string
          name: string
          note: string
          product_id: string
          ratio: number
        }
        Insert: {
          destination_key: string
          emoji?: string
          generated_at?: string
          name: string
          note?: string
          product_id: string
          ratio: number
        }
        Update: {
          destination_key?: string
          emoji?: string
          generated_at?: string
          name?: string
          note?: string
          product_id?: string
          ratio?: number
        }
        Relationships: []
      }
      event_log: {
        Row: {
          anon_id: string | null
          created_at: string
          env: string
          event_name: string
          id: string
          params: Json
          trip_id: string | null
          user_id: string | null
        }
        Insert: {
          anon_id?: string | null
          created_at?: string
          env?: string
          event_name: string
          id?: string
          params?: Json
          trip_id?: string | null
          user_id?: string | null
        }
        Update: {
          anon_id?: string | null
          created_at?: string
          env?: string
          event_name?: string
          id?: string
          params?: Json
          trip_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_log_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_accounts: {
        Row: {
          connected_at: string | null
          created_at: string
          current_balance: number
          disconnected_at: string | null
          group_id: string | null
          id: string
          institution_code: string | null
          is_mock: boolean
          masked_account_number: string | null
          updated_at: string
        }
        Insert: {
          connected_at?: string | null
          created_at?: string
          current_balance?: number
          disconnected_at?: string | null
          group_id?: string | null
          id?: string
          institution_code?: string | null
          is_mock?: boolean
          masked_account_number?: string | null
          updated_at?: string
        }
        Update: {
          connected_at?: string | null
          created_at?: string
          current_balance?: number
          disconnected_at?: string | null
          group_id?: string | null
          id?: string
          institution_code?: string | null
          is_mock?: boolean
          masked_account_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_accounts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      fund_sources: {
        Row: {
          created_at: string
          current_amount: number
          financial_account_id: string | null
          id: string
          last_synced_at: string | null
          source_type: string
          switched_from_manual_at: string | null
          trip_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_amount?: number
          financial_account_id?: string | null
          id?: string
          last_synced_at?: string | null
          source_type?: string
          switched_from_manual_at?: string | null
          trip_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_amount?: number
          financial_account_id?: string | null
          id?: string
          last_synced_at?: string | null
          source_type?: string
          switched_from_manual_at?: string | null
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fund_sources_financial_account_id_fkey"
            columns: ["financial_account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fund_sources_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: true
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          created_at: string
          group_id: string
          id: string
          joined_at: string | null
          role: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          joined_at?: string | null
          role?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          joined_at?: string | null
          role?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_user_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_user_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_user_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      insurance_referrals: {
        Row: {
          clicked_at: string
          conversion_at: string | null
          created_at: string
          external_reference: string | null
          id: string
          partner_code: string | null
          status: string
          trip_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          clicked_at?: string
          conversion_at?: string | null
          created_at?: string
          external_reference?: string | null
          id?: string
          partner_code?: string | null
          status?: string
          trip_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          clicked_at?: string
          conversion_at?: string | null
          created_at?: string
          external_reference?: string | null
          id?: string
          partner_code?: string | null
          status?: string
          trip_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "insurance_referrals_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurance_referrals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          data: Json | null
          id: string
          read_at: string | null
          title: string
          trip_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          data?: Json | null
          id?: string
          read_at?: string | null
          title: string
          trip_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          data?: Json | null
          id?: string
          read_at?: string | null
          title?: string
          trip_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      reactions: {
        Row: {
          created_at: string
          post_id: string
          reaction_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          reaction_type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          reaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      settlements: {
        Row: {
          actual_amount: number
          category_snapshot_json: Json
          confirmed_at: string | null
          created_at: string
          difference_amount: number
          difference_rate_bp: number
          id: string
          target_amount: number
          trip_id: string
          updated_at: string
        }
        Insert: {
          actual_amount?: number
          category_snapshot_json?: Json
          confirmed_at?: string | null
          created_at?: string
          difference_amount?: number
          difference_rate_bp?: number
          id?: string
          target_amount?: number
          trip_id: string
          updated_at?: string
        }
        Update: {
          actual_amount?: number
          category_snapshot_json?: Json
          confirmed_at?: string | null
          created_at?: string
          difference_amount?: number
          difference_rate_bp?: number
          id?: string
          target_amount?: number
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "settlements_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: true
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      tip_products: {
        Row: {
          created_at: string
          currency: string
          id: string
          post_id: string
          price_amount: number
          sales_status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          post_id: string
          price_amount?: number
          sales_status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          post_id?: string
          price_amount?: number
          sales_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tip_products_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: true
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      tip_purchases: {
        Row: {
          amount: number
          buyer_user_id: string | null
          created_at: string
          id: string
          purchased_at: string | null
          status: string
          tip_product_id: string
          updated_at: string
        }
        Insert: {
          amount?: number
          buyer_user_id?: string | null
          created_at?: string
          id?: string
          purchased_at?: string | null
          status?: string
          tip_product_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          buyer_user_id?: string | null
          created_at?: string
          id?: string
          purchased_at?: string | null
          status?: string
          tip_product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tip_purchases_buyer_user_id_fkey"
            columns: ["buyer_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tip_purchases_tip_product_id_fkey"
            columns: ["tip_product_id"]
            isOneToOne: false
            referencedRelation: "tip_products"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          budget_category_id: string | null
          budget_plan_item_id: string | null
          category_confidence: number | null
          category_method: string
          created_at: string
          created_by_user_id: string | null
          deleted_at: string | null
          financial_account_id: string | null
          id: string
          name: string | null
          occurred_at: string
          raw_reference: Json | null
          refund_status: string
          source_type: string
          transaction_type: string
          trip_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          budget_category_id?: string | null
          budget_plan_item_id?: string | null
          category_confidence?: number | null
          category_method?: string
          created_at?: string
          created_by_user_id?: string | null
          deleted_at?: string | null
          financial_account_id?: string | null
          id?: string
          name?: string | null
          occurred_at: string
          raw_reference?: Json | null
          refund_status?: string
          source_type?: string
          transaction_type: string
          trip_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          budget_category_id?: string | null
          budget_plan_item_id?: string | null
          category_confidence?: number | null
          category_method?: string
          created_at?: string
          created_by_user_id?: string | null
          deleted_at?: string | null
          financial_account_id?: string | null
          id?: string
          name?: string | null
          occurred_at?: string
          raw_reference?: Json | null
          refund_status?: string
          source_type?: string
          transaction_type?: string
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_budget_category_id_fkey"
            columns: ["budget_category_id"]
            isOneToOne: false
            referencedRelation: "budget_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_budget_plan_item_id_fkey"
            columns: ["budget_plan_item_id"]
            isOneToOne: false
            referencedRelation: "budget_plan_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_financial_account_id_fkey"
            columns: ["financial_account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      travel_types: {
        Row: {
          active: boolean
          code: string
          created_at: string
          description: string | null
          id: string
          image_key: string | null
          name: string
          rule_version: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          description?: string | null
          id?: string
          image_key?: string | null
          name: string
          rule_version?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          image_key?: string | null
          name?: string
          rule_version?: string
          updated_at?: string
        }
        Relationships: []
      }
      trip_budgets: {
        Row: {
          confirmed_at: string | null
          created_at: string
          id: string
          method: string
          per_person_amount: number
          recommendation_basis_json: Json
          recommended_amount: number
          target_amount: number
          trip_id: string
          updated_at: string
        }
        Insert: {
          confirmed_at?: string | null
          created_at?: string
          id?: string
          method?: string
          per_person_amount?: number
          recommendation_basis_json?: Json
          recommended_amount?: number
          target_amount?: number
          trip_id: string
          updated_at?: string
        }
        Update: {
          confirmed_at?: string | null
          created_at?: string
          id?: string
          method?: string
          per_person_amount?: number
          recommendation_basis_json?: Json
          recommended_amount?: number
          target_amount?: number
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_budgets_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: true
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_cancel_requests: {
        Row: {
          expires_at: string
          id: string
          reason: string | null
          requested_at: string
          requested_by: string
          resolved_at: string | null
          resolved_note: string | null
          status: string
          trip_id: string
        }
        Insert: {
          expires_at: string
          id?: string
          reason?: string | null
          requested_at?: string
          requested_by: string
          resolved_at?: string | null
          resolved_note?: string | null
          status?: string
          trip_id: string
        }
        Update: {
          expires_at?: string
          id?: string
          reason?: string | null
          requested_at?: string
          requested_by?: string
          resolved_at?: string | null
          resolved_note?: string | null
          status?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_cancel_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_cancel_requests_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_cancel_votes: {
        Row: {
          id: string
          request_id: string
          user_id: string
          vote: string
          voted_at: string
        }
        Insert: {
          id?: string
          request_id: string
          user_id: string
          vote: string
          voted_at?: string
        }
        Update: {
          id?: string
          request_id?: string
          user_id?: string
          vote?: string
          voted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_cancel_votes_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "trip_cancel_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_cancel_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_invites: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string
          id: string
          revoked_at: string | null
          token: string
          trip_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at: string
          id?: string
          revoked_at?: string | null
          token: string
          trip_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          revoked_at?: string | null
          token?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_invites_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_join_requests: {
        Row: {
          decided_at: string | null
          decided_by: string | null
          id: string
          invite_id: string
          requested_at: string
          status: string
          trip_id: string
          user_id: string
        }
        Insert: {
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          invite_id: string
          requested_at?: string
          status?: string
          trip_id: string
          user_id: string
        }
        Update: {
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          invite_id?: string
          requested_at?: string
          status?: string
          trip_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_join_requests_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_join_requests_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "trip_invites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_join_requests_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_join_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_members: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          left_at: string | null
          status: string
          trip_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          left_at?: string | null
          status?: string
          trip_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          left_at?: string | null
          status?: string
          trip_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_members_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_type_result_items: {
        Row: {
          created_at: string
          evidence_json: Json
          id: string
          rank: number
          score: number
          travel_type_id: string | null
          trip_type_result_id: string
        }
        Insert: {
          created_at?: string
          evidence_json?: Json
          id?: string
          rank?: number
          score?: number
          travel_type_id?: string | null
          trip_type_result_id: string
        }
        Update: {
          created_at?: string
          evidence_json?: Json
          id?: string
          rank?: number
          score?: number
          travel_type_id?: string | null
          trip_type_result_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_type_result_items_travel_type_id_fkey"
            columns: ["travel_type_id"]
            isOneToOne: false
            referencedRelation: "travel_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_type_result_items_trip_type_result_id_fkey"
            columns: ["trip_type_result_id"]
            isOneToOne: false
            referencedRelation: "trip_type_results"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_type_results: {
        Row: {
          basis_summary_json: Json
          created_at: string
          generated_at: string
          id: string
          primary_type_id: string | null
          rule_version: string
          trip_id: string
          updated_at: string
        }
        Insert: {
          basis_summary_json?: Json
          created_at?: string
          generated_at?: string
          id?: string
          primary_type_id?: string | null
          rule_version?: string
          trip_id: string
          updated_at?: string
        }
        Update: {
          basis_summary_json?: Json
          created_at?: string
          generated_at?: string
          id?: string
          primary_type_id?: string | null
          rule_version?: string
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_type_results_primary_type_id_fkey"
            columns: ["primary_type_id"]
            isOneToOne: false
            referencedRelation: "travel_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_type_results_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: true
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          cancel_reason: string | null
          canceled_at: string | null
          canceled_by: string | null
          canceled_fund_snapshot_json: Json | null
          created_at: string
          currency: string
          destination: string | null
          end_date: string | null
          group_id: string | null
          headcount: number
          id: string
          leader_user_id: string | null
          owner_type: string
          owner_user_id: string | null
          pending_group_name: string | null
          start_date: string | null
          status: string
          travel_style_json: Json
          updated_at: string
        }
        Insert: {
          cancel_reason?: string | null
          canceled_at?: string | null
          canceled_by?: string | null
          canceled_fund_snapshot_json?: Json | null
          created_at?: string
          currency?: string
          destination?: string | null
          end_date?: string | null
          group_id?: string | null
          headcount?: number
          id?: string
          leader_user_id?: string | null
          owner_type: string
          owner_user_id?: string | null
          pending_group_name?: string | null
          start_date?: string | null
          status?: string
          travel_style_json?: Json
          updated_at?: string
        }
        Update: {
          cancel_reason?: string | null
          canceled_at?: string | null
          canceled_by?: string | null
          canceled_fund_snapshot_json?: Json | null
          created_at?: string
          currency?: string
          destination?: string | null
          end_date?: string | null
          group_id?: string | null
          headcount?: number
          id?: string
          leader_user_id?: string | null
          owner_type?: string
          owner_user_id?: string | null
          pending_group_name?: string | null
          start_date?: string | null
          status?: string
          travel_style_json?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trips_canceled_by_fkey"
            columns: ["canceled_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_leader_user_id_fkey"
            columns: ["leader_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_group_list_preferences: {
        Row: {
          created_at: string
          group_id: string
          hidden: boolean
          id: string
          sort_order: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          hidden?: boolean
          id?: string
          sort_order?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          hidden?: boolean
          id?: string
          sort_order?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_group_list_preferences_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_group_list_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          auth_provider: string | null
          auth_provider_user_id: string | null
          created_at: string
          deleted_at: string | null
          english_name: string | null
          id: string
          name: string
          notification_settings_json: Json
          profile_image_url: string | null
          updated_at: string
          withdrawal_requested_at: string | null
        }
        Insert: {
          auth_provider?: string | null
          auth_provider_user_id?: string | null
          created_at?: string
          deleted_at?: string | null
          english_name?: string | null
          id: string
          name: string
          notification_settings_json?: Json
          profile_image_url?: string | null
          updated_at?: string
          withdrawal_requested_at?: string | null
        }
        Update: {
          auth_provider?: string | null
          auth_provider_user_id?: string | null
          created_at?: string
          deleted_at?: string | null
          english_name?: string | null
          id?: string
          name?: string
          notification_settings_json?: Json
          profile_image_url?: string | null
          updated_at?: string
          withdrawal_requested_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _notify_trip_members: {
        Args: {
          p_body: string
          p_data?: Json
          p_exclude: string
          p_exclude2?: string
          p_title: string
          p_trip_id: string
          p_type: string
        }
        Returns: undefined
      }
      _trip_cancel_close: {
        Args: {
          p_note: string
          p_request_id: string
          p_status: string
          p_trip_id: string
        }
        Returns: undefined
      }
      _trip_cancel_confirm: {
        Args: { p_request_id: string; p_trip_id: string }
        Returns: undefined
      }
      _trip_cancel_fund_snapshot: { Args: { p_trip_id: string }; Returns: Json }
      _trip_cancel_recheck_after_leave: {
        Args: { p_left_user_id: string; p_trip_id: string }
        Returns: string
      }
      _trip_cancel_tally: {
        Args: { p_request_id: string }
        Returns: Record<string, unknown>
      }
      _trip_leave_core: {
        Args: {
          p_also_leave_group: boolean
          p_trip_id: string
          p_user_id: string
        }
        Returns: string
      }
      accept_trip_join_request: {
        Args: { p_new_group_name?: string; p_request_id: string }
        Returns: {
          group_id: string
          request_id: string
          resolved_case: string
          trip_id: string
        }[]
      }
      activate_group_member: {
        Args: { p_group_id: string; p_user_id: string }
        Returns: undefined
      }
      activate_trip_member: {
        Args: { p_trip_id: string; p_user_id: string }
        Returns: undefined
      }
      add_group_members_to_trip: {
        Args: { p_trip_id: string }
        Returns: number
      }
      can_access_trip: { Args: { p_trip_id: string }; Returns: boolean }
      cancel_trip_join_request: {
        Args: { p_request_id: string }
        Returns: {
          request_id: string
          status: string
        }[]
      }
      cancel_withdrawal: { Args: never; Returns: undefined }
      cast_trip_cancel_vote: {
        Args: { p_request_id: string; p_vote: string }
        Returns: string
      }
      create_notification: {
        Args: {
          p_body: string
          p_data: Json
          p_title: string
          p_trip_id: string
          p_type: string
          p_user_id: string
        }
        Returns: undefined
      }
      delegate_and_leave: {
        Args: {
          p_also_leave_group?: boolean
          p_to_user_id: string
          p_trip_id: string
        }
        Returns: string
      }
      delegate_trip_leader: {
        Args: { p_to_user_id: string; p_trip_id: string }
        Returns: undefined
      }
      expire_trip_cancel_request: {
        Args: { p_trip_id: string }
        Returns: string
      }
      finalize_withdrawals: { Args: never; Returns: number }
      get_or_create_trip_invite: {
        Args: { p_trip_id: string }
        Returns: {
          expires_at: string
          invite_id: string
          token: string
        }[]
      }
      get_trip_join_requests: {
        Args: { p_trip_id: string }
        Returns: {
          has_other_trips: boolean
          is_group_member: boolean
          needs_new_group: boolean
          request_id: string
          requested_at: string
          requester_name: string
          requester_user_id: string
          status: string
          trip_owner_type: string
        }[]
      }
      is_account_active: { Args: never; Returns: boolean }
      is_group_member: { Args: { p_group_id: string }; Returns: boolean }
      leave_trip: {
        Args: { p_also_leave_group?: boolean; p_trip_id: string }
        Returns: string
      }
      notification_invite_access: {
        Args: { p_invite_id: string; p_uid: string }
        Returns: boolean
      }
      notification_person_label: { Args: { p_name: string }; Returns: string }
      notification_trip_label: {
        Args: { p_destination: string }
        Returns: string
      }
      notify_join_accepted: {
        Args: {
          p_group_id: string
          p_request_id: string
          p_trip: Database["public"]["Tables"]["trips"]["Row"]
          p_user_id: string
        }
        Returns: undefined
      }
      reject_trip_join_request: {
        Args: { p_request_id: string }
        Returns: {
          request_id: string
          status: string
        }[]
      }
      request_trip_cancel: {
        Args: { p_reason?: string; p_trip_id: string }
        Returns: Json
      }
      request_trip_join: {
        Args: { p_token: string }
        Returns: {
          request_id: string
          status: string
          trip_id: string
        }[]
      }
      request_trip_join_by_invite: {
        Args: { p_invite_id: string }
        Returns: {
          request_id: string
          status: string
          trip_id: string
        }[]
      }
      request_withdrawal: {
        Args: never
        Returns: {
          withdrawal_effective_at: string
        }[]
      }
      resolve_trip_invite: {
        Args: { p_token: string }
        Returns: {
          active_member_count: number
          destination: string
          end_date: string
          headcount: number
          invite_state: string
          inviter_name: string
          my_request_id: string
          my_state: string
          start_date: string
          trip_id: string
        }[]
      }
      resolve_trip_invite_by_id: {
        Args: { p_invite_id: string }
        Returns: {
          active_member_count: number
          destination: string
          end_date: string
          headcount: number
          invite_state: string
          inviter_name: string
          my_request_id: string
          my_state: string
          start_date: string
          trip_id: string
        }[]
      }
      restore_canceled_trip: { Args: { p_trip_id: string }; Returns: undefined }
      withdraw_trip_cancel_request: {
        Args: { p_request_id: string }
        Returns: undefined
      }
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
