import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export function hasSupabaseConfig(): boolean {
  return Boolean(url && anon && !url.includes("YOUR_") && anon.length > 10);
}

export function createBrowserSupabase(): SupabaseClient {
  if (!hasSupabaseConfig()) {
    throw new Error("Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY");
  }
  return createClient(url!, anon!, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

export type { Session };
