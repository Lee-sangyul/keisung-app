import { createClient } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "missing-anon-key";
export const supabase = createClient(url, key);
export const accountEmail = (id: string) => `${id.trim().toLowerCase()}@login.keisung-app.example`;
export type Role = "student" | "teacher" | "admin" | "superadmin";
export type Profile = { id: string; username: string; display_name: string; role: Role; grade: number | null; class_number: number | null; student_number: number | null; must_change_password: boolean; disabled: boolean; created_at: string };
