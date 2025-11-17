// src/lib/supabaseAdmin.ts
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.SUPABASE_URL as string;
const SUPABASE_SERVICE_KEY = import.meta.env.SUPABASE_SERVICE_KEY as string;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error("Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY en .env.local");
}

// Cliente solo para el backend (admin)
export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    persistSession: false,
  },
});
