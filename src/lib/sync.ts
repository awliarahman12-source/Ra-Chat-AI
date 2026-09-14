import { supabase } from './supabase';
import { useChatStore } from '@/store/chatStore';
import type { Conversation, Provider, AppSettings } from '@/types';

interface SyncSnapshot {
  conversations: Conversation[];
  activeConversationId: string | null;
  providers: Provider[];
  settings: AppSettings;
}

function getLocalSnapshot(): SyncSnapshot {
  const state = useChatStore.getState();
  return {
    conversations: state.conversations,
    activeConversationId: state.activeConversationId,
    providers: state.providers,
    settings: state.settings,
  };
}

function isLocalDataEmpty(snapshot: SyncSnapshot): boolean {
  // Only counts as "real" data once the user actually has a conversation —
  // a freshly-installed app with just the default OpenAI provider (no key)
  // shouldn't overwrite whatever is already saved in the cloud.
  return snapshot.conversations.length === 0;
}

async function fetchRemoteRow(userId: string): Promise<{ ok: boolean; data: SyncSnapshot | null }> {
  if (!supabase) return { ok: false, data: null };
  const { data, error } = await supabase
    .from('user_data')
    .select('data')
    .eq('user_id', userId)
    .maybeSingle();

  // A genuine connection/query error is NOT the same as "no row exists yet" —
  // treating them the same would risk overwriting real cloud data with an
  // empty local device just because of a flaky connection.
  if (error) return { ok: false, data: null };
  return { ok: true, data: data ? (data.data as SyncSnapshot) : null };
}

export async function pushToCloud(userId: string): Promise<void> {
  if (!supabase) return;
  const snapshot = getLocalSnapshot();
  await supabase.from('user_data').upsert({
    user_id: userId,
    data: snapshot,
    updated_at: new Date().toISOString(),
  });
}

let pushTimer: ReturnType<typeof setTimeout> | null = null;

/** Debounced push — called on every relevant local change while signed in. */
export function schedulePush(userId: string, delayMs = 1500): void {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushToCloud(userId).catch(() => {
      // Best-effort only — the data is always safe in localStorage regardless.
    });
  }, delayMs);
}

/**
 * Runs once right after sign-in. If the account already has cloud data,
 * that becomes the source of truth for this device (this is what makes a
 * second device — e.g. a phone — see the desktop's chats). If the cloud has
 * nothing yet, this device's local data is pushed up to seed it. If the
 * cloud can't be reached at all, local data is left untouched and nothing
 * is pushed, so a flaky connection can't wipe out real cloud data.
 */
export async function syncOnSignIn(userId: string): Promise<void> {
  const remote = await fetchRemoteRow(userId);
  if (!remote.ok) return;

  if (remote.data) {
    useChatStore.setState({
      conversations: remote.data.conversations,
      activeConversationId: remote.data.activeConversationId,
      providers: remote.data.providers,
      settings: remote.data.settings,
    });
    return;
  }

  const local = getLocalSnapshot();
  if (!isLocalDataEmpty(local)) {
    await pushToCloud(userId);
  }
}
