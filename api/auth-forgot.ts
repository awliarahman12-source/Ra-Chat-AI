import { getAdminClient, getAnonClient, normalizeUsername } from './_lib/supabaseAdmin';

interface ApiRequest { method?: string; body?: unknown; }
interface ApiResponse { status: (code: number) => ApiResponse; json: (data: unknown) => void; }

const GENERIC_MESSAGE = 'If that username exists, a reset link has been sent to its registered email.';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Always the same response either way — this prevents anyone from using
  // this endpoint to check which usernames exist.
  const generic = { ok: true, message: GENERIC_MESSAGE };

  const admin = getAdminClient();
  const anon = getAnonClient();
  if (!admin || !anon) return res.status(200).json(generic);

  const body = (req.body || {}) as { username?: string; origin?: string };
  const uname = normalizeUsername(body.username || '');
  if (!uname) return res.status(200).json(generic);

  const { data: profile } = await admin.from('profiles').select('user_id').eq('username', uname).maybeSingle();
  if (profile) {
    const { data: userData } = await admin.auth.admin.getUserById(profile.user_id);
    const email = userData.user?.email;
    if (email) {
      const origin = typeof body.origin === 'string' && body.origin.startsWith('https://') ? body.origin : undefined;
      await anon.auth.resetPasswordForEmail(email, origin ? { redirectTo: origin } : undefined);
    }
  }

  return res.status(200).json(generic);
}
