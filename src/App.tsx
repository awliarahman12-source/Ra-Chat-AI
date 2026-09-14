import { useEffect } from 'react';
import { useChatStore } from '@/store/chatStore';
import { useCloudSync } from '@/hooks/useCloudSync';
import { Sidebar } from '@/components/Sidebar';
import { ChatWindow } from '@/components/ChatWindow';
import { SettingsModal } from '@/components/SettingsModal';
import { ToastContainer } from '@/components/Toast';
import { PasscodeRecoveryModal } from '@/components/PasscodeRecoveryModal';

function App() {
  const theme = useChatStore((s) => s.settings.theme);
  const conversations = useChatStore((s) => s.conversations);
  const activeConversationId = useChatStore((s) => s.activeConversationId);
  const createConversation = useChatStore((s) => s.createConversation);

  useCloudSync();

  useEffect(() => {
    const root = document.documentElement;

    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    if (conversations.length === 0 && !activeConversationId) {
      createConversation();
    }
  }, [conversations.length, activeConversationId, createConversation]);

  return (
    <div className="flex h-[100dvh] w-full min-w-0 overflow-hidden bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <Sidebar />

      <main className="min-h-0 min-w-0 flex-1 overflow-hidden">
        <ChatWindow />
      </main>

      <SettingsModal />
      <ToastContainer />
      <PasscodeRecoveryModal />
    </div>
  );
}

export default App;
