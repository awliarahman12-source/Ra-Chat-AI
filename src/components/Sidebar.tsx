import { useState, useRef, useEffect } from 'react';
import {
  Plus,
  Search,
  Settings,
  Trash2,
  Pencil,
  Check,
  X,
  MessageSquare,
  PanelLeftClose,
} from 'lucide-react';
import { useChatStore } from '@/store/chatStore';

export function Sidebar() {
  const conversations = useChatStore((s) => s.conversations);
  const activeConversationId = useChatStore((s) => s.activeConversationId);
  const searchQuery = useChatStore((s) => s.searchQuery);
  const sidebarOpen = useChatStore((s) => s.sidebarOpen);
  const providers = useChatStore((s) => s.providers);

  const createConversation = useChatStore((s) => s.createConversation);
  const deleteConversation = useChatStore((s) => s.deleteConversation);
  const renameConversation = useChatStore((s) => s.renameConversation);
  const setActiveConversation = useChatStore((s) => s.setActiveConversation);
  const setSidebarOpen = useChatStore((s) => s.setSidebarOpen);
  const setSettingsOpen = useChatStore((s) => s.setSettingsOpen);
  const setSearchQuery = useChatStore((s) => s.setSearchQuery);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  const activeProviderCount = providers.filter((provider) => provider.isActive).length;

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const filteredConversations = conversations.filter((conversation) =>
    conversation.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const closeMobileDrawer = () => {
    setSidebarOpen(false);
  };

  const handleNewChat = () => {
    createConversation();
    closeMobileDrawer();
  };

  const handleSelectConversation = (conversationId: string) => {
    setActiveConversation(conversationId);
    closeMobileDrawer();
  };

  const handleOpenSettings = () => {
    setSettingsOpen(true);
    closeMobileDrawer();
  };

  const handleStartRename = (id: string, currentTitle: string) => {
    setEditingId(id);
    setEditTitle(currentTitle);
  };

  const handleConfirmRename = () => {
    if (editingId && editTitle.trim()) {
      renameConversation(editingId, editTitle.trim());
    }

    setEditingId(null);
  };

  const handleDelete = (id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    deleteConversation(id);
  };

  const sidebarContent = (
    <div className="flex h-full w-full min-w-0 flex-col bg-neutral-50 dark:bg-neutral-900">
      {/* Header */}
      <div className="pt-safe flex shrink-0 items-center justify-between gap-2 px-3 pb-3">
        <span className="min-w-0 truncate text-lg font-bold tracking-tight text-neutral-800 dark:text-neutral-100">
          AI Chat
        </span>

        <button
          type="button"
          aria-label="Tutup sidebar"
          onClick={closeMobileDrawer}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-800 lg:hidden"
        >
          <PanelLeftClose className="h-5 w-5" />
        </button>
      </div>

      {/* Tombol chat baru */}
      <div className="shrink-0 px-3 pb-3">
        <button
          type="button"
          onClick={handleNewChat}
          className="flex min-h-11 w-full items-center gap-2.5 rounded-xl bg-neutral-200 px-3 py-2.5 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-300 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700"
        >
          <Plus className="h-4.5 w-4.5 shrink-0" />
          <span className="truncate">New Chat</span>
        </button>
      </div>

      {/* Pencarian */}
      <div className="shrink-0 px-3 pb-3">
        <div className="relative min-w-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />

          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search conversations..."
            className="min-h-11 w-full min-w-0 rounded-lg border border-neutral-200 bg-neutral-100 py-2 pl-9 pr-3 text-base text-neutral-700 outline-none transition-all placeholder:text-neutral-400 focus:ring-2 focus:ring-neutral-300 dark:border-neutral-700/50 dark:bg-neutral-800/50 dark:text-neutral-200 dark:focus:ring-neutral-600 sm:text-sm"
          />
        </div>
      </div>

      {/* Daftar chat */}
      <div className="sidebar-scroll min-h-0 min-w-0 flex-1 overflow-y-auto px-2 pb-2">
        {filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-3 py-12 text-center text-neutral-400 dark:text-neutral-600">
            <MessageSquare className="mb-2 h-8 w-8" />
            <p className="break-words text-sm">
              {searchQuery ? 'No conversations found' : 'No conversations yet'}
            </p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {filteredConversations.map((conversation) => (
              <div
                key={conversation.id}
                role="button"
                tabIndex={0}
                onClick={() => handleSelectConversation(conversation.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    handleSelectConversation(conversation.id);
                  }
                }}
                className={`group flex min-w-0 cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 transition-colors ${
                  activeConversationId === conversation.id
                    ? 'bg-neutral-200 text-neutral-900 dark:bg-neutral-800 dark:text-white'
                    : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800/50'
                }`}
              >
                {editingId === conversation.id ? (
                  <div className="flex min-w-0 flex-1 items-center gap-1">
                    <input
                      ref={editInputRef}
                      value={editTitle}
                      onChange={(event) => setEditTitle(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          handleConfirmRename();
                        }

                        if (event.key === 'Escape') {
                          setEditingId(null);
                        }
                      }}
                      onClick={(event) => event.stopPropagation()}
                      className="min-h-9 min-w-0 flex-1 rounded border border-neutral-300 bg-white px-2 py-0.5 text-base text-neutral-800 outline-none focus:ring-1 focus:ring-neutral-400 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 sm:text-sm"
                    />

                    <button
                      type="button"
                      aria-label="Simpan nama percakapan"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleConfirmRename();
                      }}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded hover:bg-neutral-300 dark:hover:bg-neutral-700"
                    >
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                    </button>

                    <button
                      type="button"
                      aria-label="Batalkan ubah nama"
                      onClick={(event) => {
                        event.stopPropagation();
                        setEditingId(null);
                      }}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded hover:bg-neutral-300 dark:hover:bg-neutral-700"
                    >
                      <X className="h-3.5 w-3.5 text-neutral-500" />
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {conversation.title}
                    </span>

                    <div className="flex shrink-0 items-center gap-0.5 opacity-100 transition-opacity lg:opacity-0 lg:group-hover:opacity-100">
                      <button
                        type="button"
                        aria-label={`Ubah nama ${conversation.title}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          handleStartRename(conversation.id, conversation.title);
                        }}
                        className="grid h-9 w-9 place-items-center rounded text-neutral-400 transition-colors hover:bg-neutral-300 hover:text-neutral-600 dark:hover:bg-neutral-700 dark:hover:text-neutral-200"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>

                      <button
                        type="button"
                        aria-label={`Hapus ${conversation.title}`}
                        onClick={(event) => handleDelete(conversation.id, event)}
                        className="grid h-9 w-9 place-items-center rounded text-neutral-400 transition-colors hover:bg-neutral-300 hover:text-red-500 dark:hover:bg-neutral-700"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="pb-safe shrink-0 space-y-2 border-t border-neutral-200 p-3 dark:border-neutral-800">
        <div className="flex min-w-0 items-center justify-between px-2 text-xs text-neutral-400 dark:text-neutral-500">
          <span className="truncate">
            {activeProviderCount} active provider
            {activeProviderCount !== 1 ? 's' : ''}
          </span>
        </div>

        <button
          type="button"
          onClick={handleOpenSettings}
          className="flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-200 dark:text-neutral-200 dark:hover:bg-neutral-800"
        >
          <Settings className="h-4.5 w-4.5 shrink-0" />
          <span className="truncate">Settings</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Sidebar statis untuk desktop besar. */}
      <aside className="hidden h-full w-72 shrink-0 border-r border-neutral-200 dark:border-neutral-800 lg:flex">
        {sidebarContent}
      </aside>

      {/* Drawer untuk mobile dan tablet. */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-50 flex lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Navigasi percakapan"
        >
          <button
            type="button"
            aria-label="Tutup sidebar"
            className="absolute inset-0 bg-black/40 animate-fadeIn"
            onClick={closeMobileDrawer}
          />

          <aside className="relative z-10 h-[100dvh] w-[min(86vw,320px)] min-w-0 border-r border-neutral-200 bg-neutral-50 shadow-2xl animate-slideInLeft dark:border-neutral-800 dark:bg-neutral-900">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
