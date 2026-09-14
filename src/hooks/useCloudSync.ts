import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useChatStore } from '@/store/chatStore';
import { supabase } from '@/lib/supabase';
import { syncOnSignIn, schedulePush } from '@/lib/sync';

/**
 * Wires the chat store up to Supabase, entirely opt-in:
 * - If Supabase isn't configured, this is a no-op and the app behaves
 *   exactly as it always has (localStorage only).
 * - Once signed in, pulls (or seeds) cloud data once, then pushes local
 *   changes to the cloud on a short debounce.
 */
export function useCloudSync(): void {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const hasSyncedRef = useRef(false);

  useEffect(() => {
    useAuthStore.getState().init();
  }, []);

  useEffect(() => {
    if (status === 'signed-in' && user && !hasSyncedRef.current) {
      hasSyncedRef.current = true;
      syncOnSignIn(user.id);
    }
    if (status === 'signed-out') {
      hasSyncedRef.current = false;
    }
  }, [status, user]);

  useEffect(() => {
    if (!supabase) return;

    const unsubscribe = useChatStore.subscribe((state, prevState) => {
      // Only react to the fields that actually get synced — ignore pure UI
      // state (isStreaming, sidebar/settings open, toasts, search query).
      const changed =
        state.conversations !== prevState.conversations ||
        state.activeConversationId !== prevState.activeConversationId ||
        state.providers !== prevState.providers ||
        state.settings !== prevState.settings;

      if (!changed) return;
      if (!hasSyncedRef.current) return;

      const currentUser = useAuthStore.getState().user;
      if (!currentUser) return;

      schedulePush(currentUser.id);
    });

    return unsubscribe;
  }, []);
}
