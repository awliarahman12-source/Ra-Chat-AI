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

  const activeProviderCount = providers.filter((p) => p.isActive).length;

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const filtered = conversations.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleNewChat = () => {
    createConversation();
    setSidebarOpen(false);
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

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteConversation(id);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-neutral-50 dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 w-72">
      {/* Header */}
      <div className="p-3 pt-safe flex items-center justify-between">
        <span className="text-lg font-bold text-neutral-800 dark:text-neutral-100 tracking-tight">AI Chat</span>
        <button
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden p-1.5 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-500"
        >
          <PanelLeftClose className="w-5 h-5" />
        </button>
      </div>

      {/* New Chat button */}
      <div className="px-3 pb-3">
        <button
          onClick={handleNewChat}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-neutral-200 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 font-medium text-sm hover:bg-neutral-300 dark:hover:bg-neutral-700 transition-colors"
        >
          <Plus className="w-4.5 h-4.5" />
          New Chat
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-neutral-100 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700/50 text-neutral-700 dark:text-neutral-200 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-300 dark:focus:ring-neutral-600 transition-all"
          />
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 sidebar-scroll">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-neutral-400 dark:text-neutral-600">
            <MessageSquare className="w-8 h-8 mb-2" />
            <p className="text-sm">{searchQuery ? 'No conversations found' : 'No conversations yet'}</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {filtered.map((conv) => (
              <div
                key={conv.id}
                onClick={() => setActiveConversation(conv.id)}
                className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                  activeConversationId === conv.id
                    ? 'bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-white'
                    : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800/50'
                }`}
              >
                {editingId === conv.id ? (
                  <div className="flex items-center gap-1 flex-1">
                    <input
                      ref={editInputRef}
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleConfirmRename();
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-600 rounded px-2 py-0.5 text-sm text-neutral-800 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-neutral-400"
                    />
                    <button onClick={(e) => { e.stopPropagation(); handleConfirmRename(); }} className="p-1 rounded hover:bg-neutral-300 dark:hover:bg-neutral-700">
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setEditingId(null); }} className="p-1 rounded hover:bg-neutral-300 dark:hover:bg-neutral-700">
                      <X className="w-3.5 h-3.5 text-neutral-500" />
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="flex-1 truncate text-sm">{conv.title}</span>
                    <div className="hidden group-hover:flex items-center gap-0.5">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleStartRename(conv.id, conv.title); }}
                        className="p-1 rounded hover:bg-neutral-300 dark:hover:bg-neutral-700 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => handleDelete(conv.id, e)}
                        className="p-1 rounded hover:bg-neutral-300 dark:hover:bg-neutral-700 text-neutral-400 hover:text-red-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
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
      <div className="border-t border-neutral-200 dark:border-neutral-800 p-3 pb-safe space-y-2">
        <div className="flex items-center justify-between px-2 text-xs text-neutral-400 dark:text-neutral-500">
          <span>{activeProviderCount} active provider{activeProviderCount !== 1 ? 's' : ''}</span>
        </div>
        <button
          onClick={() => setSettingsOpen(true)}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors"
        >
          <Settings className="w-4.5 h-4.5" />
          Settings
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-shrink-0">{sidebarContent}</aside>

      {/* Mobile drawer */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/40 animate-fadeIn"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="relative z-10 animate-slideInLeft">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
