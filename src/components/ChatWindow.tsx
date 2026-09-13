import { useRef, useEffect, useState } from 'react';
import { Menu, Sparkles } from 'lucide-react';
import { useChatStore } from '@/store/chatStore';
import { MessageBubble } from './MessageBubble';
import { ModelSelector } from './ModelSelector';
import { InputBox } from './InputBox';

function TypingIndicator() {
  return (
    <div className="flex justify-start px-4 sm:px-6 py-3 animate-fadeInUp">
      <div className="flex gap-3 max-w-[75%]">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
          <div className="flex gap-1">
            <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
        <div className="bg-white dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700/50 rounded-2xl rounded-tl-md px-4 py-3.5">
          <div className="flex gap-1">
            <span className="w-2 h-2 bg-neutral-300 dark:bg-neutral-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 bg-neutral-300 dark:bg-neutral-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 bg-neutral-300 dark:bg-neutral-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ChatWindow() {
  const conversations = useChatStore((s) => s.conversations);
  const activeConversationId = useChatStore((s) => s.activeConversationId);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const setSidebarOpen = useChatStore((s) => s.setSidebarOpen);
  const createConversation = useChatStore((s) => s.createConversation);
  const regenerateResponse = useChatStore((s) => s.regenerateResponse);

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const activeConversation = conversations.find((c) => c.id === activeConversationId);
  const messages = activeConversation?.messages || [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isStreaming]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    setShowScrollButton(!isNearBottom && messages.length > 5);
  };

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  if (!activeConversation || messages.length === 0) {
    return (
      <div className="flex flex-col flex-1 h-full bg-white dark:bg-neutral-950">
        <ChatHeader onMenuClick={() => setSidebarOpen(true)} />
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center mb-4 shadow-lg">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-neutral-800 dark:text-neutral-100 mb-2">
            How can I help you?
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm sm:text-base text-center max-w-md mb-8">
            Start a conversation by typing below. Pick any AI model from the selector to get started.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl mb-8">
            {[
              { title: 'Explain a concept', desc: 'Break down a complex topic in simple terms' },
              { title: 'Write some code', desc: 'Get help with a programming problem' },
              { title: 'Brainstorm ideas', desc: 'Generate creative suggestions for any project' },
              { title: 'Draft an email', desc: 'Compose a professional message quickly' },
            ].map((s) => (
              <button
                key={s.title}
                onClick={() => {
                  if (!activeConversationId) {
                    createConversation();
                  }
                }}
                className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 text-left hover:border-neutral-300 dark:hover:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800/50 transition-all group"
              >
                <p className="font-semibold text-sm text-neutral-800 dark:text-neutral-100 mb-1">{s.title}</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">{s.desc}</p>
              </button>
            ))}
          </div>
        </div>
        <InputBox />
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 h-full bg-white dark:bg-neutral-950">
      <ChatHeader onMenuClick={() => setSidebarOpen(true)} />
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto chat-scroll"
      >
        <div className="max-w-3xl mx-auto py-4">
          {messages.map((msg, idx) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isLast={idx === messages.length - 1}
              onRegenerate={regenerateResponse}
              canRegenerate={!isStreaming && msg.role === 'assistant'}
            />
          ))}
          {isStreaming && messages[messages.length - 1]?.role !== 'assistant' && (
            <TypingIndicator />
          )}
          <div ref={bottomRef} className="h-4" />
        </div>
      </div>

      {showScrollButton && (
        <div className="flex justify-center pb-2">
          <button
            onClick={scrollToBottom}
            className="px-3 py-1.5 text-xs rounded-full bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-700 transition-colors animate-fadeIn"
          >
            Scroll to bottom
          </button>
        </div>
      )}

      <InputBox />
    </div>
  );
}

function ChatHeader({ onMenuClick }: { onMenuClick: () => void }) {
  return (
    <header className="flex items-center gap-2 px-3 sm:px-4 py-2.5 border-b border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-950/80 backdrop-blur-sm sticky top-0 z-10">
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300"
      >
        <Menu className="w-5 h-5" />
      </button>
      <div className="flex-1" />
      <ModelSelector />
    </header>
  );
}
