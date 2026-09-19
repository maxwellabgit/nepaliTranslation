import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readPublicEnv } from '../config/env';

let client: SupabaseClient | null = null;
let refreshBound = false;

export function getSupabase(): SupabaseClient | null {
  const env = readPublicEnv();
  if (!env.authConfigured) return null;
  if (!client) {
    client = createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}

/** Refresh the session while the app is foregrounded. */
export function bindAuthRefresh(supabase: SupabaseClient): void {
  if (refreshBound) return;
  refreshBound = true;
  AppState.addEventListener('change', (state) => {
    if (state === 'active') void supabase.auth.startAutoRefresh();
    else void supabase.auth.stopAutoRefresh();
  });
}
