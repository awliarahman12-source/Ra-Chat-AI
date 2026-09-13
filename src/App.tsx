import { useEffect } from 'react';
import { useChatStore } from '@/store/chatStore';
import { Sidebar } from '@/components/Sidebar';
import { ChatWindow } from '@/components/ChatWindow';
import { SettingsModal } from '@/components/SettingsModal';
import { ToastContainer } from '@/components/Toast';

function App() {
  const theme = useChatStore((s) => s.settings.theme);
  const conversations = useChatStore((s) => s.conversations);
  const activeConversationId = useChatStore((s) => s.activeConversationId);
  const createConversation = useChatStore((s) => s.createConversation);

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  // Create an initial conversation on first load if none exists
  useEffect(() => {
    if (conversations.length === 0 && !activeConversationId) {
      createConversation();
    }
  }, [conversations.length, activeConversationId, createConversation]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100">
      <Sidebar />
      <ChatWindow />
      <SettingsModal />
      <ToastContainer />
    </div>
  );
}

export default App;
