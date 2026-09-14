import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

type AuthStatus = 'loading' | 'signed-out' | 'signed-in';

interface AuthState {
  session: Session | null;
  user: User | null;
  status: AuthStatus;
  emailSent: boolean;
  error: string | null;
  initialized: boolean;

  init: () => void;
  signInWithEmail: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetEmailSent: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  status: supabase ? 'loading' : 'signed-out',
  emailSent: false,
  error: null,
  initialized: false,

  init: () => {
    if (get().initialized) return;
    set({ initialized: true });

    if (!supabase) {
      set({ status: 'signed-out' });
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      set({
        session: data.session,
        user: data.session?.user ?? null,
        status: data.session ? 'signed-in' : 'signed-out',
      });
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      set({
        session,
        user: session?.user ?? null,
        status: session ? 'signed-in' : 'signed-out',
      });
    });
  },

  signInWithEmail: async (email) => {
    if (!supabase) return;
    set({ error: null });
    const trimmed = email.trim();
    if (!trimmed) {
      set({ error: 'Enter an email address.' });
      return;
    }
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) {
      set({ error: error.message });
    } else {
      set({ emailSent: true });
    }
  },

  signOut: async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  },

  resetEmailSent: () => set({ emailSent: false, error: null }),
}));
