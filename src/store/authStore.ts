import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

type AuthStatus = 'loading' | 'signed-out' | 'signed-in';

interface AuthState {
  session: Session | null;
  user: User | null;
  username: string | null;
  status: AuthStatus;
  recoveryMode: boolean;
  error: string | null;
  info: string | null;
  initialized: boolean;

  init: () => void;
  register: (username: string, email: string, passcode: string) => Promise<boolean>;
  login: (username: string, passcode: string) => Promise<boolean>;
  requestPasscodeReset: (username: string) => Promise<void>;
  setNewPasscode: (passcode: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  clearMessages: () => void;
}

async function fetchUsername(userId: string): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.from('profiles').select('username').eq('user_id', userId).maybeSingle();
  return data?.username ?? null;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  username: null,
  status: supabase ? 'loading' : 'signed-out',
  recoveryMode: false,
  error: null,
  info: null,
  initialized: false,

  init: () => {
    if (get().initialized) return;
    set({ initialized: true });

    if (!supabase) {
      set({ status: 'signed-out' });
      return;
    }

    // Optimistic check: a reset-passcode link lands here with `type=recovery`
    // in the URL hash. We flag this immediately rather than waiting only on
    // the auth event below, since that event can fire before this listener
    // finishes attaching.
    if (typeof window !== 'undefined' && window.location.hash.includes('type=recovery')) {
      set({ recoveryMode: true });
    }

    supabase.auth.getSession().then(async ({ data }) => {
      const uname = data.session ? await fetchUsername(data.session.user.id) : null;
      set((state) => ({
        session: data.session,
        user: data.session?.user ?? null,
        username: uname,
        status: state.recoveryMode ? state.status : data.session ? 'signed-in' : 'signed-out',
      }));
    });

    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        set({ recoveryMode: true, session, user: session?.user ?? null });
        return;
      }
      const uname = session ? await fetchUsername(session.user.id) : null;
      set({
        session,
        user: session?.user ?? null,
        username: uname,
        status: session ? 'signed-in' : 'signed-out',
      });
    });
  },

  register: async (username, email, passcode) => {
    set({ error: null, info: null });
    try {
      const res = await fetch('/api/auth-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, passcode }),
      });
      const data = await res.json();
      if (!res.ok) {
        set({ error: data.error || 'Registration failed.' });
        return false;
      }
      // Auto sign-in right after successful registration, no extra step.
      return await get().login(username, passcode);
    } catch {
      set({ error: 'Network error. Please try again.' });
      return false;
    }
  },

  login: async (username, passcode) => {
    if (!supabase) return false;
    set({ error: null, info: null });
    try {
      const res = await fetch('/api/auth-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, passcode }),
      });
      const data = await res.json();
      if (!res.ok) {
        set({ error: data.error || 'Login failed.' });
        return false;
      }
      const { error } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });
      if (error) {
        set({ error: error.message });
        return false;
      }
      return true;
    } catch {
      set({ error: 'Network error. Please try again.' });
      return false;
    }
  },

  requestPasscodeReset: async (username) => {
    set({ error: null, info: null });
    try {
      const res = await fetch('/api/auth-forgot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, origin: window.location.origin }),
      });
      const data = await res.json();
      set({ info: data.message || 'If that username exists, a reset link has been sent.' });
    } catch {
      set({ error: 'Network error. Please try again.' });
    }
  },

  setNewPasscode: async (passcode) => {
    if (!supabase) return false;
    set({ error: null, info: null });
    if (passcode.length < 4) {
      set({ error: 'Passcode must be at least 4 characters.' });
      return false;
    }
    const { error } = await supabase.auth.updateUser({ password: passcode });
    if (error) {
      set({ error: error.message });
      return false;
    }
    set({ recoveryMode: false, info: 'Passcode updated. You are signed in.' });
    return true;
  },

  signOut: async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    set({ username: null });
  },

  clearMessages: () => set({ error: null, info: null }),
}));
