import { readPublicEnv } from '../../config/env';
import { getSupabase } from '../../services/supabase';
import type { SharingToggles } from '../../storage/sharingToggles';

/** Mirror default-off sharing choices to the upload authorization boundary. */
export async function recordSharingToggles(
  toggles: SharingToggles,
): Promise<{ ok: boolean }> {
  try {
    const env = readPublicEnv();
    const supabase = getSupabase();
    if (!env.authConfigured || !supabase) return { ok: false };
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const userId = data.session?.user?.id;
    if (!token || !userId) return { ok: false };
    const res = await fetch(
      `${env.supabaseUrl}/rest/v1/rpc/service_set_sharing_toggles`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          apikey: env.supabaseAnonKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          p_user_id: userId,
          p_speech: toggles.speech === true,
          p_photos: toggles.photos === true,
        }),
      },
    );
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
}
