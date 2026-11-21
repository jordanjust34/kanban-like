// HAND-WRITTEN placeholder in the shape `supabase gen types typescript` produces.
// Replaced by the generated file at the Phase 1 gate. Do not edit by hand after that:
// regenerate with `npx supabase gen types typescript --project-id <ref> > src/lib/database.types.ts`.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      tasks: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description: string | null;
          status: string;
          priority: string;
          due_date: string | null;
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          title: string;
          description?: string | null;
          status?: string;
          priority?: string;
          due_date?: string | null;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          description?: string | null;
          status?: string;
          priority?: string;
          due_date?: string | null;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      team_members: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          color: string;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          name: string;
          color?: string;
          avatar_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          color?: string;
          avatar_url?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      task_assignees: {
        Row: { task_id: string; member_id: string; user_id: string; created_at: string };
        Insert: { task_id: string; member_id: string; user_id?: string; created_at?: string };
        Update: { task_id?: string; member_id?: string; user_id?: string; created_at?: string };
        Relationships: [
          {
            foreignKeyName: 'task_assignees_task_id_user_id_fkey';
            columns: ['task_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['id', 'user_id'];
          },
          {
            foreignKeyName: 'task_assignees_member_id_user_id_fkey';
            columns: ['member_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'team_members';
            referencedColumns: ['id', 'user_id'];
          },
        ];
      };
      labels: {
        Row: { id: string; user_id: string; name: string; color: string; created_at: string };
        Insert: { id?: string; user_id?: string; name: string; color: string; created_at?: string };
        Update: { id?: string; user_id?: string; name?: string; color?: string; created_at?: string };
        Relationships: [];
      };
      task_labels: {
        Row: { task_id: string; label_id: string; user_id: string };
        Insert: { task_id: string; label_id: string; user_id?: string };
        Update: { task_id?: string; label_id?: string; user_id?: string };
        Relationships: [
          {
            foreignKeyName: 'task_labels_task_id_user_id_fkey';
            columns: ['task_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['id', 'user_id'];
          },
          {
            foreignKeyName: 'task_labels_label_id_user_id_fkey';
            columns: ['label_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'labels';
            referencedColumns: ['id', 'user_id'];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

type PublicSchema = Database['public'];

export type Tables<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row'];
export type TablesInsert<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Update'];
