import { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowUp, Square, CornerDownLeft } from 'lucide-react';
import { useChatStore } from '@/store/chatStore';

export function InputBox() {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeConversationId = useChatStore((s) => s.activeConversationId);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const stopStreaming = useChatStore((s) => s.stopStreaming);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [input, adjustHeight]);

  // Focus when conversation changes
  useEffect(() => {
    textareaRef.current?.focus();
  }, [activeConversationId]);

  const handleSend = () => {
    if (input.trim() && !isStreaming) {
      const content = input;
      setInput('');
      sendMessage(content);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="px-3 sm:px-4 pb-3 sm:pb-4 pt-1 bg-gradient-to-t from-white dark:from-neutral-950 via-white dark:via-neutral-950 to-transparent">
      <div className="max-w-3xl mx-auto">
        <div className="relative flex items-end gap-2 rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 px-3 py-2 focus-within:ring-2 focus-within:ring-neutral-300 dark:focus-within:ring-neutral-600 transition-all">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Send a message..."
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm sm:text-base text-neutral-800 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none max-h-[200px] py-1.5"
            style={{ minHeight: '24px' }}
          />
          {isStreaming ? (
            <button
              onClick={stopStreaming}
              className="flex-shrink-0 w-8 h-8 rounded-lg bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600 flex items-center justify-center transition-colors"
              title="Stop generating"
            >
              <Square className="w-3.5 h-3.5 text-neutral-700 dark:text-neutral-200 fill-current" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="flex-shrink-0 w-8 h-8 rounded-lg bg-neutral-800 dark:bg-neutral-100 text-white dark:text-neutral-900 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-neutral-700 dark:hover:bg-white transition-all"
              title="Send message"
            >
              <ArrowUp className="w-4.5 h-4.5" />
            </button>
          )}
        </div>
        <div className="flex items-center justify-center gap-1.5 mt-2 text-[11px] text-neutral-400 dark:text-neutral-500">
          <CornerDownLeft className="w-3 h-3" />
          <span>to send</span>
          <span className="opacity-50">·</span>
          <span>Shift + Enter for new line</span>
        </div>
      </div>
    </div>
  );
}
