import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://oxqvhnjdntuxtwrbisax.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94cXZobmpkbnR1eHR3cmJpc2F4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MzU1MjMsImV4cCI6MjA5NTMxMTUyM30.k_zMzD2I8_41kid0zNkefJZ_jtxDLQ8Twam4f1psp2k";

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);