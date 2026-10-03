import { handleGuestDataDeletion } from '../_shared/guestDataDeletion.ts';

Deno.serve((req) => handleGuestDataDeletion(req, {
  url: Deno.env.get('SUPABASE_URL'),
  anonKey: Deno.env.get('SUPABASE_ANON_KEY'),
}));
