import { getAdminClient, getAnonClient, normalizeUsername } from './_lib/supabaseAdmin';

interface ApiRequest { method?: string; body?: unknown; }
interface ApiResponse { status: (code: number) => ApiResponse; json: (data: unknown) => void; }

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const admin = getAdminClient();
  const anon = getAnonClient();
  if (!admin || !anon) {
    return res.status(500).json({ error: 'Cloud sync is not configured on the server.' });
  }

  const body = (req.body || {}) as { username?: string; passcode?: string };
  const { username, passcode } = body;

  const invalid = () => res.status(401).json({ error: 'Invalid username or passcode.' });

  if (!username || !passcode) return invalid();

  const uname = normalizeUsername(username);
  const { data: profile } = await admin.from('profiles').select('user_id').eq('username', uname).maybeSingle();
  if (!profile) return invalid(); // Never reveal whether the username exists.

  const { data: userData, error: userError } = await admin.auth.admin.getUserById(profile.user_id);
  if (userError || !userData.user?.email) return invalid();

  // The actual password check happens here, using the anon key like any
  // normal client-side sign-in would — we're just doing it server-side so
  // the real email never has to be sent to the browser.
  const { data: signInData, error: signInError } = await anon.auth.signInWithPassword({
    email: userData.user.email,
    password: passcode,
  });

  if (signInError || !signInData.session) return invalid();

  return res.status(200).json({
    access_token: signInData.session.access_token,
    refresh_token: signInData.session.refresh_token,
  });
}
