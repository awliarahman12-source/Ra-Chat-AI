import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { streamChatCompletion, buildApiMessages } from '@/api/chat';
import type { Conversation, Message, Provider, AppSettings, ToastMessage } from '@/types';

const STORAGE_VERSION = 2;

export type AttachmentKind = 'image' | 'text';

export interface ChatAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  kind: AttachmentKind;
  dataUrl?: string;
  textContent?: string;
  previewUrl?: string;
}

let activeAbortController: AbortController | null = null;

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
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

type MultimodalMessage = {
  role: string;
  content: string | Array<Record<string, unknown>>;
};

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

  createConversation: (providerId?: string, model?: string) => string;
  deleteConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;
  setActiveConversation: (id: string) => void;
  addMessage: (conversationId: string, message: Message) => void;
  updateMessage: (conversationId: string, messageId: string, content: string) => void;
  setConversationModel: (conversationId: string, providerId: string, model: string) => void;
  clearAllConversations: () => void;

  addProvider: (provider: Omit<Provider, 'id'>) => string;
  updateProvider: (id: string, updates: Partial<Provider>) => void;
  deleteProvider: (id: string) => void;
  setDefaultProvider: (id: string) => void;
  toggleProviderActive: (id: string) => void;

  updateSettings: (updates: Partial<AppSettings>) => void;

  setStreaming: (streaming: boolean) => void;
  setSidebarOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setSearchQuery: (query: string) => void;
  addToast: (type: ToastMessage['type'], message: string) => void;
  removeToast: (id: string) => void;

  sendMessage: (
    content: string,
    attachments?: ChatAttachment[],
  ) => Promise<void>;
  regenerateResponse: () => Promise<void>;
  stopStreaming: () => void;
}

function resolveProvider(providers: Provider[], preferredId?: string) {
  return (
    providers.find((provider) => provider.id === preferredId && provider.isActive) ||
    providers.find((provider) => provider.isDefault && provider.isActive) ||
    providers.find((provider) => provider.isActive)
  );
}

function getMessageAttachments(message: Message): ChatAttachment[] {
  const messageWithAttachments = message as Message & {
    attachments?: ChatAttachment[];
  };

  return messageWithAttachments.attachments || [];
}

function createMultimodalMessages(
  messages: Message[],
  systemPrompt: string,
): MultimodalMessage[] {
  const apiMessages = buildApiMessages(messages, systemPrompt) as MultimodalMessage[];

  return apiMessages.map((apiMessage, index) => {
    const sourceMessage = messages[index - 1];

    if (!sourceMessage || sourceMessage.role !== 'user') {
      return apiMessage;
    }

    const attachments = getMessageAttachments(sourceMessage);

    if (attachments.length === 0) {
      return apiMessage;
    }

    const contentParts: Array<Record<string, unknown>> = [];

    if (typeof apiMessage.content === 'string') {
      contentParts.push({
        type: 'text',
        text: apiMessage.content || 'Analyze the attached files.',
      });
    } else {
      contentParts.push(...apiMessage.content);
    }

    for (const attachment of attachments) {
      if (attachment.kind === 'image' && attachment.dataUrl) {
        contentParts.push({
          type: 'image_url',
          image_url: {
            url: attachment.dataUrl,
          },
        });
      }

      if (attachment.kind === 'text' && attachment.textContent) {
        contentParts.push({
          type: 'text',
          text:
            `\n\n--- File: ${attachment.name} (${attachment.type}) ---\n` +
            attachment.textContent +
            `\n--- End file: ${attachment.name} ---`,
        });
      }
    }

    return {
      ...apiMessage,
      content: contentParts,
    };
  });
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => {
      const runCompletion = async (
        conversationId: string,
        assistantId: string,
        apiMessages: MultimodalMessage[],
        provider: Provider,
        model: string,
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
              const currentConversation = get().conversations.find(
                (conversation) => conversation.id === conversationId,
              );

              const currentMessage = currentConversation?.messages.find(
                (message) => message.id === assistantId,
              );

              get().updateMessage(
                conversationId,
                assistantId,
                `${currentMessage?.content || ''}${token}`,
              );
            },
          });
        } catch (error) {
          if (!controller.signal.aborted) {
            const errorMessage =
              error instanceof Error
                ? error.message
                : 'An unexpected error occurred.';

            get().updateMessage(conversationId, assistantId, errorMessage);

            set((state) => ({
              conversations: state.conversations.map((conversation) =>
                conversation.id === conversationId
                  ? {
                      ...conversation,
                      messages: conversation.messages.map((message) =>
                        message.id === assistantId
                          ? { ...message, error: true }
                          : message,
                      ),
                    }
                  : conversation,
              ),
            }));

            get().addToast('error', errorMessage);
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

          const defaultProvider =
            get().providers.find(
              (provider) => provider.isDefault && provider.isActive,
            ) || get().providers.find((provider) => provider.isActive);

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
            const conversations = state.conversations.filter(
              (conversation) => conversation.id !== id,
            );

            const activeConversationId =
              state.activeConversationId === id
                ? conversations[0]?.id || null
                : state.activeConversationId;

            return {
              conversations,
              activeConversationId,
            };
          });
        },

        renameConversation: (id, title) => {
          set((state) => ({
            conversations: state.conversations.map((conversation) =>
              conversation.id === id
                ? { ...conversation, title, updatedAt: Date.now() }
                : conversation,
            ),
          }));
        },

        setActiveConversation: (id) => {
          set({
            activeConversationId: id,
            sidebarOpen: false,
          });
        },

        addMessage: (conversationId, message) => {
          set((state) => ({
            conversations: state.conversations.map((conversation) => {
              if (conversation.id !== conversationId) {
                return conversation;
              }

              const updatedConversation: Conversation = {
                ...conversation,
                messages: [...conversation.messages, message],
                updatedAt: Date.now(),
              };

              if (conversation.title === 'New Chat' && message.role === 'user') {
                const titleSource =
                  message.content.trim() || 'Attachment conversation';

                updatedConversation.title =
                  titleSource.slice(0, 40) +
                  (titleSource.length > 40 ? '…' : '');
              }

              return updatedConversation;
            }),
          }));
        },

        updateMessage: (conversationId, messageId, content) => {
          set((state) => ({
            conversations: state.conversations.map((conversation) =>
              conversation.id === conversationId
                ? {
                    ...conversation,
                    messages: conversation.messages.map((message) =>
                      message.id === messageId
                        ? { ...message, content }
                        : message,
                    ),
                    updatedAt: Date.now(),
                  }
                : conversation,
            ),
          }));
        },

        setConversationModel: (conversationId, providerId, model) => {
          set((state) => ({
            conversations: state.conversations.map((conversation) =>
              conversation.id === conversationId
                ? { ...conversation, providerId, model }
                : conversation,
            ),
          }));
        },

        clearAllConversations: () => {
          set({
            conversations: [],
            activeConversationId: null,
          });
        },

        addProvider: (provider) => {
          const id = generateId();

          set((state) => {
            const isFirstProvider = state.providers.length === 0;

            return {
              providers: [
                ...state.providers,
                {
                  ...provider,
                  id,
                  isDefault: provider.isDefault || isFirstProvider,
                },
              ],
            };
          });

          return id;
        },

        updateProvider: (id, updates) => {
          set((state) => ({
            providers: state.providers.map((provider) =>
              provider.id === id ? { ...provider, ...updates } : provider,
            ),
          }));
        },

        deleteProvider: (id) => {
          set((state) => {
            const providers = state.providers.filter(
              (provider) => provider.id !== id,
            );

            const deletedWasDefault = state.providers.find(
              (provider) => provider.id === id,
            )?.isDefault;

            if (deletedWasDefault && providers.length > 0) {
              providers[0] = {
                ...providers[0],
                isDefault: true,
              };
            }

            return { providers };
          });
        },

        setDefaultProvider: (id) => {
          set((state) => ({
            providers: state.providers.map((provider) => ({
              ...provider,
              isDefault: provider.id === id,
            })),
          }));
        },

        toggleProviderActive: (id) => {
          set((state) => ({
            providers: state.providers.map((provider) =>
              provider.id === id
                ? { ...provider, isActive: !provider.isActive }
                : provider,
            ),
          }));
        },

        updateSettings: (updates) => {
          set((state) => ({
            settings: {
              ...state.settings,
              ...updates,
            },
          }));
        },

        setStreaming: (streaming) => set({ isStreaming: streaming }),
        setSidebarOpen: (open) => set({ sidebarOpen: open }),
        setSettingsOpen: (open) => set({ settingsOpen: open }),
        setSearchQuery: (query) => set({ searchQuery: query }),

        addToast: (type, message) => {
          const id = generateId();

          set((state) => ({
            toasts: [...state.toasts, { id, type, message }],
          }));

          setTimeout(() => {
            set((state) => ({
              toasts: state.toasts.filter((toast) => toast.id !== id),
            }));
          }, 5000);
        },

        removeToast: (id) => {
          set((state) => ({
            toasts: state.toasts.filter((toast) => toast.id !== id),
          }));
        },

        sendMessage: async (content, attachments = []) => {
          const trimmedContent = content.trim();

          if (
            (!trimmedContent && attachments.length === 0) ||
            get().isStreaming
          ) {
            return;
          }

          let conversationId = get().activeConversationId;

          if (!conversationId) {
            conversationId = get().createConversation();
          }

          const conversation = get().conversations.find(
            (item) => item.id === conversationId,
          );

          const provider = resolveProvider(
            get().providers,
            conversation?.providerId,
          );

          if (!provider) {
            get().addToast(
              'error',
              'No active AI provider configured. Please add one in Settings.',
            );
            return;
          }

          if (!provider.apiKey) {
            get().addToast(
              'error',
              `No API key set for "${provider.name}". Add it in Settings to start chatting.`,
            );
            return;
          }

          const model = conversation?.model || provider.models[0];

          if (!model) {
            get().addToast(
              'error',
              'No model selected. Please choose a model from the selector above.',
            );
            return;
          }

          const userMessage = {
            id: generateId(),
            role: 'user' as const,
            content: trimmedContent,
            createdAt: Date.now(),
            attachments,
          } as Message;

          get().addMessage(conversationId, userMessage);

          const updatedConversation = get().conversations.find(
            (item) => item.id === conversationId,
          );

          const apiMessages = createMultimodalMessages(
            updatedConversation?.messages || [],
            get().settings.systemPrompt,
          );

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

          await runCompletion(
            conversationId,
            assistantId,
            apiMessages,
            provider,
            model,
          );
        },

        regenerateResponse: async () => {
          const conversationId = get().activeConversationId;

          if (!conversationId || get().isStreaming) {
            return;
          }

          const conversation = get().conversations.find(
            (item) => item.id === conversationId,
          );

          if (!conversation || conversation.messages.length === 0) {
            return;
          }

          const lastMessage = conversation.messages[conversation.messages.length - 1];

          if (lastMessage.role !== 'assistant') {
            return;
          }

          const provider = resolveProvider(
            get().providers,
            lastMessage.providerId || conversation.providerId,
          );

          if (!provider) {
            get().addToast(
              'error',
              'No active AI provider configured. Please add one in Settings.',
            );
            return;
          }

          if (!provider.apiKey) {
            get().addToast(
              'error',
              `No API key set for "${provider.name}". Add it in Settings to start chatting.`,
            );
            return;
          }

          const model =
            lastMessage.model ||
            conversation.model ||
            provider.models[0];

          if (!model) {
            get().addToast(
              'error',
              'No model selected. Please choose a model from the selector above.',
            );
            return;
          }

          const priorMessages = conversation.messages.slice(0, -1);

          set((state) => ({
            conversations: state.conversations.map((item) =>
              item.id === conversationId
                ? {
                    ...item,
                    messages: priorMessages,
                    updatedAt: Date.now(),
                  }
                : item,
            ),
          }));

          const apiMessages = createMultimodalMessages(
            priorMessages,
            get().settings.systemPrompt,
          );

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

          await runCompletion(
            conversationId,
            assistantId,
            apiMessages,
            provider,
            model,
          );
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
    },
  ),
);