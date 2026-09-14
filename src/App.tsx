import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
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

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useCloudSync();

  // Terapkan tema ke elemen HTML.
  useEffect(() => {
    const root = document.documentElement;

    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  // Buat satu percakapan awal bila belum ada.
  useEffect(() => {
    if (conversations.length === 0 && !activeConversationId) {
      createConversation();
    }
  }, [conversations.length, activeConversationId, createConversation]);

  // Tutup drawer mobile saat layar berubah menjadi desktop.
  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 768px)');

    const handleDesktopLayout = () => {
      if (mediaQuery.matches) {
        setIsSidebarOpen(false);
      }
    };

    handleDesktopLayout();
    mediaQuery.addEventListener('change', handleDesktopLayout);

    return () => {
      mediaQuery.removeEventListener('change', handleDesktopLayout);
    };
  }, []);

  return (
    <div className="flex h-[100dvh] w-full min-w-0 overflow-hidden bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      {/* Backdrop muncul hanya ketika drawer sidebar mobile terbuka. */}
      {isSidebarOpen && (
        <button
          type="button"
          aria-label="Tutup menu navigasi"
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[1px] md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar:
          - Mobile: drawer dari kiri.
          - Desktop: bagian layout normal, selalu terlihat. */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 flex w-[min(86vw,320px)]
          shrink-0 flex-col border-r border-neutral-200 bg-white
          shadow-2xl transition-transform duration-300 ease-out
          dark:border-neutral-800 dark:bg-neutral-950
          md:static md:z-auto md:w-72 md:translate-x-0 md:shadow-none
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Tombol penutup sidebar hanya tampil pada mobile. */}
        <div className="flex h-14 shrink-0 items-center justify-end border-b border-neutral-200 px-2 dark:border-neutral-800 md:hidden">
          <button
            type="button"
            aria-label="Tutup sidebar"
            className="grid h-11 w-11 place-items-center rounded-lg text-neutral-700 transition hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
            onClick={() => setIsSidebarOpen(false)}
          >
            <X size={22} />
          </button>
        </div>

        {/* Sidebar dapat discroll jika daftar chat panjang. */}
        <div className="sidebar-scroll min-h-0 flex-1 overflow-y-auto">
          <Sidebar />
        </div>
      </aside>

      {/* Bagian utama chat. */}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Header khusus mobile agar pengguna bisa membuka drawer. */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-neutral-200 bg-white px-3 dark:border-neutral-800 dark:bg-neutral-950 md:hidden">
          <button
            type="button"
            aria-label="Buka menu navigasi"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-neutral-700 transition hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
            onClick={() => setIsSidebarOpen(true)}
          >
            <Menu size={23} />
          </button>

          <span className="min-w-0 truncate text-sm font-semibold">
            Ra Chat AI
          </span>
        </header>

        {/* ChatWindow memperoleh seluruh tinggi yang tersisa dan tidak boleh
            memaksa layout melebar keluar layar. */}
        <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
          <ChatWindow />
        </div>
      </main>

      {/* Modal dan toast diletakkan di luar area scroll chat. */}
      <SettingsModal />
      <ToastContainer />
      <PasscodeRecoveryModal />
    </div>
  );
}

export default App;
