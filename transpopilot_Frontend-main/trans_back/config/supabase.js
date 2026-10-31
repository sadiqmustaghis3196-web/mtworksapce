import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

export const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
export const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error("Missing Supabase configuration. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
}

const keyTypeUsed = process.env.SUPABASE_SERVICE_ROLE_KEY
  ? 'SERVICE_ROLE_KEY'
  : process.env.SUPABASE_SERVICE_KEY
  ? 'SERVICE_KEY'
  : process.env.SUPABASE_KEY
  ? 'SUPABASE_KEY'
  : 'VITE_SUPABASE_ANON_KEY';

console.log('[supabase] Using key type:', keyTypeUsed);

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});
