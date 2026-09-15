import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { streamChatCompletion, buildApiMessages } from '@/api/chat';
import type {
  Conversation,
  Message,
  MessageContent,
  Provider,
  AppSettings,
  ToastMessage,
  Attachment,
  Role,
} from '@/types';

const STORAGE_VERSION = 1;

// Kept outside the persisted state on purpose: an AbortController isn't
// serializable and doesn't need to survive a reload — only one stream can be
// active at a time, so a single module-level reference is enough.
let activeAbortController: AbortController | null = null;

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Ambil teks dari MessageContent (string atau array part).
 * Dipakai untuk auto-title dan fallback.
 */
function extractText(content: MessageContent): string {
  if (typeof content === 'string') return content;
  const textPart = content.find((p) => p.type === 'text');
  return textPart && textPart.type === 'text' ? textPart.text : '';
}

function createDefaultProvider(): Provider {
  return {
    id: generateId(),
    name: 'OpenAI',
    type: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'],
    isActive: true,
    isDefault: true,
  };
}

function createDefaultSettings(): AppSettings {
  return {
    temperature: 0.7,
    maxTokens: 2048,
    theme: 'dark',
    systemPrompt: 'You are a helpful, friendly AI assistant. Answer clearly and concisely.',
  };
}

interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  providers: Provider[];
  settings: AppSettings;
  toasts: ToastMessage[];
  isStreaming: boolean;
  sidebarOpen: boolean;
  settingsOpen: boolean;
  searchQuery: string;

  // Conversation actions
  createConversation: (providerId?: string, model?: string) => string;
  deleteConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;
  setActiveConversation: (id: string) => void;
  addMessage: (conversationId: string, message: Message) => void;
  updateMessage: (conversationId: string, messageId: string, content: MessageContent) => void;
  setConversationModel: (conversationId: string, providerId: string, model: string) => void;
  clearAllConversations: () => void;

  // Provider actions
  addProvider: (provider: Omit<Provider, 'id'>) => string;
  updateProvider: (id: string, updates: Partial<Provider>) => void;
  deleteProvider: (id: string) => void;
  setDefaultProvider: (id: string) => void;
  toggleProviderActive: (id: string) => void;

  // Settings actions
  updateSettings: (updates: Partial<AppSettings>) => void;

  // UI actions
  setStreaming: (streaming: boolean) => void;
  setSidebarOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setSearchQuery: (query: string) => void;
  addToast: (type: ToastMessage['type'], message: string) => void;
  removeToast: (id: string) => void;

  // Completion actions (send / regenerate / stop share the same streaming logic)
  sendMessage: (content: string, attachments?: Attachment[]) => Promise<void>;
  regenerateResponse: () => Promise<void>;
  stopStreaming: () => void;
}

function resolveProvider(providers: Provider[], preferredId?: string) {
  return (
    providers.find((p) => p.id === preferredId && p.isActive) ||
    providers.find((p) => p.isDefault && p.isActive) ||
    providers.find((p) => p.isActive)
  );
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => {
      // Shared by sendMessage and regenerateResponse: runs the actual
      // provider request, streaming tokens into the given assistant message.
      const runCompletion = async (
        conversationId: string,
        assistantId: string,
        apiMessages: { role: Role; content: MessageContent }[],
        provider: Provider,
        model: string
      ) => {
        set({ isStreaming: true });
        const controller = new AbortController();
        activeAbortController = controller;

        try {
          await streamChatCompletion({
            messages: apiMessages,
            provider,
            model,
            settings: get().settings,
            signal: controller.signal,
            onToken: (token) => {
              const currentConv = get().conversations.find((c) => c.id === conversationId);
              const currentMsg = currentConv?.messages.find((m) => m.id === assistantId);
              // Assistant messages are always text-only, so content stays a string.
              const prev = typeof currentMsg?.content === 'string' ? currentMsg.content : '';
              get().updateMessage(conversationId, assistantId, prev + token);
            },
          });
        } catch (err) {
          if (controller.signal.aborted) {
            // Partial response stays as-is.
          } else {
            const errorMsg = err instanceof Error ? err.message : 'An unexpected error occurred.';
            get().updateMessage(conversationId, assistantId, errorMsg);
            set((state) => ({
              conversations: state.conversations.map((c) =>
                c.id === conversationId
                  ? { ...c, messages: c.messages.map((m) => (m.id === assistantId ? { ...m, error: true } : m)) }
                  : c
              ),
            }));
            get().addToast('error', errorMsg);
          }
        } finally {
          set({ isStreaming: false });
          activeAbortController = null;
        }
      };

      return {
      conversations: [],
      activeConversationId: null,
      providers: [createDefaultProvider()],
      settings: createDefaultSettings(),
      toasts: [],
      isStreaming: false,
      sidebarOpen: false,
      settingsOpen: false,
      searchQuery: '',

      createConversation: (providerId, model) => {
        const id = generateId();
        const defaultProvider = get().providers.find((p) => p.isDefault && p.isActive) || get().providers.find((p) => p.isActive);
        const conversation: Conversation = {
          id,
          title: 'New Chat',
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          providerId: providerId || defaultProvider?.id,
          model: model || defaultProvider?.models[0],
        };
        set((state) => ({
          conversations: [conversation, ...state.conversations],
          activeConversationId: id,
        }));
        return id;
      },

      deleteConversation: (id) => {
        set((state) => {
          const filtered = state.conversations.filter((c) => c.id !== id);
          const newActive = state.activeConversationId === id
            ? (filtered[0]?.id || null)
            : state.activeConversationId;
          return {
            conversations: filtered,
            activeConversationId: newActive,
          };
        });
      },

      renameConversation: (id, title) => {
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === id ? { ...c, title, updatedAt: Date.now() } : c
          ),
        }));
      },

      setActiveConversation: (id) => {
        set({ activeConversationId: id, sidebarOpen: false });
      },

      addMessage: (conversationId, message) => {
        set((state) => ({
          conversations: state.conversations.map((c) => {
            if (c.id !== conversationId) return c;
            const updated = { ...c, messages: [...c.messages, message], updatedAt: Date.now() };

            // Auto-title from first user message
            if (c.title === 'New Chat' && message.role === 'user') {
              const text = extractText(message.content).trim();
              if (text) {
                updated.title = text.slice(0, 40) + (text.length > 40 ? '…' : '');
              } else if (message.attachments && message.attachments.length > 0) {
                updated.title =
                  message.attachments.length === 1
                    ? `📷 ${message.attachments[0].name}`
                    : `📷 ${message.attachments.length} images`;
              }
            }
            return updated;
          }),
        }));
      },

      updateMessage: (conversationId, messageId, content) => {
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === messageId ? { ...m, content } : m
                  ),
                  updatedAt: Date.now(),
                }
              : c
          ),
        }));
      },

      setConversationModel: (conversationId, providerId, model) => {
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === conversationId ? { ...c, providerId, model } : c
          ),
        }));
      },

      clearAllConversations: () => {
        set({ conversations: [], activeConversationId: null });
      },

      addProvider: (provider) => {
        const id = generateId();
        set((state) => {
          const isFirst = state.providers.length === 0;
          return {
            providers: [
              ...state.providers,
              { ...provider, id, isDefault: provider.isDefault || isFirst },
            ],
          };
        });
        return id;
      },

      updateProvider: (id, updates) => {
        set((state) => ({
          providers: state.providers.map((p) =>
            p.id === id ? { ...p, ...updates } : p
          ),
        }));
      },

      deleteProvider: (id) => {
        set((state) => {
          const filtered = state.providers.filter((p) => p.id !== id);
          const deletedWasDefault = state.providers.find((p) => p.id === id)?.isDefault;
          if (deletedWasDefault && filtered.length > 0) {
            filtered[0] = { ...filtered[0], isDefault: true };
          }
          return { providers: filtered };
        });
      },

      setDefaultProvider: (id) => {
        set((state) => ({
          providers: state.providers.map((p) => ({
            ...p,
            isDefault: p.id === id,
          })),
        }));
      },

      toggleProviderActive: (id) => {
        set((state) => ({
          providers: state.providers.map((p) =>
            p.id === id ? { ...p, isActive: !p.isActive } : p
          ),
        }));
      },

      updateSettings: (updates) => {
        set((state) => ({ settings: { ...state.settings, ...updates } }));
      },

      setStreaming: (streaming) => set({ isStreaming: streaming }),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setSettingsOpen: (open) => set({ settingsOpen: open }),
      setSearchQuery: (query) => set({ searchQuery: query }),

      addToast: (type, message) => {
        const id = generateId();
        set((state) => ({ toasts: [...state.toasts, { id, type, message }] }));
        setTimeout(() => {
          set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
        }, 5000);
      },

      removeToast: (id) => {
        set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
      },

      // ============================================================
      // SEND MESSAGE (with optional image attachments)
      // ============================================================
      sendMessage: async (content, attachments) => {
        const trimmed = content.trim();
        const hasAttachments = !!attachments && attachments.length > 0;

        if ((!trimmed && !hasAttachments) || get().isStreaming) return;

        let conversationId = get().activeConversationId;
        if (!conversationId) {
          conversationId = get().createConversation();
        }

        const conv = get().conversations.find((c) => c.id === conversationId);
        const provider = resolveProvider(get().providers, conv?.providerId);

        if (!provider) {
          get().addToast('error', 'No active AI provider configured. Please add one in Settings.');
          return;
        }
        if (!provider.apiKey) {
          get().addToast('error', `No API key set for "${provider.name}". Add it in Settings to start chatting.`);
          return;
        }
        const model = conv?.model || provider.models[0];
        if (!model) {
          get().addToast('error', 'No model selected. Please choose a model from the selector above.');
          return;
        }

        // ---- Bangun content: string biasa atau array multimodal ----
        let messageContent: MessageContent;
        if (hasAttachments) {
          const parts: Array<
            | { type: 'text'; text: string }
            | { type: 'image_url'; image_url: { url: string } }
          > = [];

          if (trimmed) {
            parts.push({ type: 'text', text: trimmed });
          }
          for (const att of attachments!) {
            parts.push({
              type: 'image_url',
              image_url: { url: att.dataUrl },
            });
          }
          messageContent = parts;
        } else {
          messageContent = trimmed;
        }

        const userMessage: Message = {
          id: generateId(),
          role: 'user',
          content: messageContent,
          createdAt: Date.now(),
          attachments: hasAttachments ? attachments : undefined,
        };
        get().addMessage(conversationId, userMessage);

        const updatedConv = get().conversations.find((c) => c.id === conversationId);
        const apiMessages = buildApiMessages(updatedConv?.messages || [], get().settings.systemPrompt);

        const assistantId = generateId();
        const assistantMessage: Message = {
          id: assistantId,
          role: 'assistant',
          content: '',
          createdAt: Date.now(),
          providerId: provider.id,
          model,
        };
        get().addMessage(conversationId, assistantMessage);

        await runCompletion(conversationId, assistantId, apiMessages, provider, model);
      },

      // ============================================================
      // REGENERATE
      // ============================================================
      regenerateResponse: async () => {
        const conversationId = get().activeConversationId;
        if (!conversationId || get().isStreaming) return;

        const conv = get().conversations.find((c) => c.id === conversationId);
        if (!conv || conv.messages.length === 0) return;

        const lastMsg = conv.messages[conv.messages.length - 1];
        if (lastMsg.role !== 'assistant') return;

        const provider = resolveProvider(get().providers, lastMsg.providerId || conv.providerId);
        if (!provider) {
          get().addToast('error', 'No active AI provider configured. Please add one in Settings.');
          return;
        }
        if (!provider.apiKey) {
          get().addToast('error', `No API key set for "${provider.name}". Add it in Settings to start chatting.`);
          return;
        }
        const model = lastMsg.model || conv.model || provider.models[0];
        if (!model) {
          get().addToast('error', 'No model selected. Please choose a model from the selector above.');
          return;
        }

        const priorMessages = conv.messages.slice(0, -1);
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === conversationId ? { ...c, messages: priorMessages } : c
          ),
        }));

        const apiMessages = buildApiMessages(priorMessages, get().settings.systemPrompt);

        const assistantId = generateId();
        const assistantMessage: Message = {
          id: assistantId,
          role: 'assistant',
          content: '',
          createdAt: Date.now(),
          providerId: provider.id,
          model,
        };
        get().addMessage(conversationId, assistantMessage);

        await runCompletion(conversationId, assistantId, apiMessages, provider, model);
      },

      stopStreaming: () => {
        activeAbortController?.abort();
      },
      };
    },
    {
      name: 'ai-chat-store',
      version: STORAGE_VERSION,
      partialize: (state) => ({
        conversations: state.conversations,
        activeConversationId: state.activeConversationId,
        providers: state.providers,
        settings: state.settings,
      }),
    }
  )
);