import { getAdminClient, normalizeUsername, isValidUsername } from './_lib/supabaseAdmin.js';

interface ApiRequest { method?: string; body?: unknown; }
interface ApiResponse { status: (code: number) => ApiResponse; json: (data: unknown) => void; }

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const admin = getAdminClient();
  if (!admin) {
    return res.status(500).json({ error: 'Cloud sync is not configured on the server.' });
  }

  const body = (req.body || {}) as { username?: string; email?: string; passcode?: string };
  const { username, email, passcode } = body;

  if (!username || !email || !passcode) {
    return res.status(400).json({ error: 'Username, email, and passcode are all required.' });
  }

  const uname = normalizeUsername(username);
  if (!isValidUsername(uname)) {
    return res.status(400).json({ error: 'Username must be 3-20 characters: letters, numbers, or underscore only.' });
  }
  if (typeof passcode !== 'string' || passcode.length < 4) {
    return res.status(400).json({ error: 'Passcode must be at least 4 characters.' });
  }

  const { data: existing } = await admin.from('profiles').select('user_id').eq('username', uname).maybeSingle();
  if (existing) {
    return res.status(409).json({ error: 'That username is already taken.' });
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: String(email).trim(),
    password: passcode,
    email_confirm: true, // No confirmation email needed — the whole point is to avoid email friction.
  });

  if (createError || !created.user) {
    return res.status(400).json({ error: createError?.message || 'Could not create account. That email may already be registered.' });
  }

  const { error: profileError } = await admin.from('profiles').insert({
    user_id: created.user.id,
    username: uname,
  });

  if (profileError) {
    // Roll back the auth user so we don't leave an orphaned account with no username.
    await admin.auth.admin.deleteUser(created.user.id);
    return res.status(500).json({ error: 'Could not finish registration. Please try again.' });
  }

  return res.status(200).json({ ok: true });
}
