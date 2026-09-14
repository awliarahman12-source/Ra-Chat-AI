import { useState, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import {
  Copy,
  Check,
  RefreshCw,
  User,
  Bot,
  AlertCircle,
  Wrench,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import type { Message } from '@/types';

interface MessageBubbleProps {
  message: Message;
  isLast: boolean;
  onRegenerate: () => void;
  canRegenerate: boolean;
}

function CodeBlock({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group/code my-3 rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-700">
      <div className="flex items-center justify-between px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800/80 text-xs text-neutral-500 dark:text-neutral-400">
        <span className="font-mono">
          {className?.replace('language-', '') || 'code'}
        </span>

        <button
          onClick={handleCopy}
          className="flex items-center gap-1 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-emerald-500" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>

      <pre className="p-4 overflow-x-auto text-sm bg-neutral-50 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200">
        <code className={className}>{children}</code>
      </pre>
    </div>
  );
}

function ToolActivity({ message }: { message: Message }) {
  const [expanded, setExpanded] = useState(false);

  const hasCalls = Boolean(message.toolCalls?.length);
  const hasResults = Boolean(message.toolResults?.length);

  if (!hasCalls && !hasResults) {
    return null;
  }

  return (
    <div className="mb-2 rounded-xl border border-neutral-200 dark:border-neutral-700/70 overflow-hidden bg-neutral-50/80 dark:bg-neutral-900/40">
      <button
        onClick={() => setExpanded((value) => !value)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800/60 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="w-3.5 h-3.5" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5" />
        )}

        <Wrench className="w-3.5 h-3.5" />

        <span className="font-medium">
          {hasResults ? 'Tool activity' : 'Using tool'}
        </span>

        <span className="text-neutral-400 dark:text-neutral-500">
          {message.toolCalls?.length || message.toolResults?.length || 0}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-neutral-200 dark:border-neutral-700/70 px-3 py-2 space-y-2">
          {message.toolCalls?.map((call) => (
            <div
              key={call.id}
              className="rounded-lg bg-white dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700/60 p-2.5"
            >
              <div className="flex items-center gap-2 mb-1">
                <Wrench className="w-3.5 h-3.5 text-neutral-500" />
                <span className="text-xs font-medium text-neutral-700 dark:text-neutral-200">
                  {call.toolName}
                </span>
              </div>

              <pre className="text-[11px] leading-relaxed overflow-x-auto text-neutral-500 dark:text-neutral-400">
                {JSON.stringify(call.arguments, null, 2)}
              </pre>
            </div>
          ))}

          {message.toolResults?.map((toolResult) => (
            <div
              key={toolResult.toolCallId}
              className="rounded-lg bg-white dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700/60 p-2.5"
            >
              <div className="flex items-center gap-2 mb-1">
                <Wrench className="w-3.5 h-3.5 text-neutral-500" />
                <span className="text-xs font-medium text-neutral-700 dark:text-neutral-200">
                  {toolResult.toolName}
                </span>

                {toolResult.error && (
                  <span className="text-[10px] text-red-500">Error</span>
                )}
              </div>

              <pre className="text-[11px] leading-relaxed overflow-x-auto whitespace-pre-wrap break-words text-neutral-500 dark:text-neutral-400">
                {toolResult.error ||
                  (typeof toolResult.result === 'string'
                    ? toolResult.result
                    : JSON.stringify(toolResult.result, null, 2))}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export const MessageBubble = memo(function MessageBubble({
  message,
  isLast,
  onRegenerate,
  canRegenerate,
}: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isUser) {
    return (
      <div className="flex justify-end animate-fadeInUp px-4 sm:px-6 py-3">
        <div className="flex gap-3 max-w-[85%] sm:max-w-[75%]">
          <div className="flex-1 bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 rounded-2xl rounded-tr-md px-4 py-2.5 text-sm sm:text-base leading-relaxed whitespace-pre-wrap break-words">
            {message.content}
          </div>

          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-neutral-700 dark:bg-neutral-200 flex items-center justify-center">
            <User className="w-4.5 h-4.5 text-white dark:text-neutral-800" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start animate-fadeInUp px-4 sm:px-6 py-3">
      <div className="flex gap-3 max-w-[85%] sm:max-w-[75%]">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
          <Bot className="w-4.5 h-4.5 text-white" />
        </div>

        <div className="flex-1 min-w-0">
          {message.error ? (
            <div className="flex items-start gap-2 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 rounded-2xl rounded-tl-md px-4 py-2.5 text-sm text-red-700 dark:text-red-300">
              <AlertCircle className="w-4.5 h-4.5 flex-shrink-0 mt-0.5" />
              <span>{message.content}</span>
            </div>
          ) : (
            <>
              <ToolActivity message={message} />

              <div className="bg-white dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700/50 text-neutral-800 dark:text-neutral-100 rounded-2xl rounded-tl-md px-4 py-3 text-sm sm:text-base leading-relaxed break-words">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeHighlight]}
                  components={{
                    pre: ({ children }) => <>{children}</>,

                    code: ({ className, children, ...props }) => {
                      const isInline = !className;

                      if (isInline) {
                        return (
                          <code
                            className="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-700/60 text-neutral-700 dark:text-neutral-200 text-sm font-mono"
                            {...props}
                          >
                            {children}
                          </code>
                        );
                      }

                      return (
                        <CodeBlock className={className}>
                          {String(children).replace(/\n$/, '')}
                        </CodeBlock>
                      );
                    },

                    table: ({ children }) => (
                      <div className="overflow-x-auto my-3">
                        <table className="min-w-full border-collapse border border-neutral-200 dark:border-neutral-700 text-sm">
                          {children}
                        </table>
                      </div>
                    ),

                    th: ({ children }) => (
                      <th className="border border-neutral-200 dark:border-neutral-700 px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 font-semibold text-left">
                        {children}
                      </th>
                    ),

                    td: ({ children }) => (
                      <td className="border border-neutral-200 dark:border-neutral-700 px-3 py-1.5">
                        {children}
                      </td>
                    ),

                    a: ({ children, href }) => (
                      
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline"
                      >
                        {children}
                      </a>
                    ),

                    ul: ({ children }) => (
                      <ul className="list-disc pl-5 my-2 space-y-1">
                        {children}
                      </ul>
                    ),

                    ol: ({ children }) => (
                      <ol className="list-decimal pl-5 my-2 space-y-1">
                        {children}
                      </ol>
                    ),

                    p: ({ children }) => (
                      <p className="mb-2 last:mb-0">{children}</p>
                    ),

                    h1: ({ children }) => (
                      <h1 className="text-xl font-bold mt-3 mb-2">
                        {children}
                      </h1>
                    ),

                    h2: ({ children }) => (
                      <h2 className="text-lg font-bold mt-3 mb-2">
                        {children}
                      </h2>
                    ),

                    h3: ({ children }) => (
                      <h3 className="text-base font-semibold mt-2 mb-1.5">
                        {children}
                      </h3>
                    ),

                    blockquote: ({ children }) => (
                      <blockquote className="border-l-3 border-neutral-300 dark:border-neutral-600 pl-3 my-2 italic text-neutral-600 dark:text-neutral-400">
                        {children}
                      </blockquote>
                    ),

                    hr: () => (
                      <hr className="border-neutral-200 dark:border-neutral-700 my-3" />
                    ),
                  }}
                >
                  {message.content || '▍'}
                </ReactMarkdown>
              </div>
            </>
          )}

          {!message.error && message.content && (
            <div className="flex items-center gap-1 mt-1.5 ml-1">
              <button
                onClick={handleCopy}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                title="Copy response"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>

              {isLast && canRegenerate && (
                <button
                  onClick={onRegenerate}
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                  title="Regenerate response"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              )}

              {message.model && (
                <span className="text-[11px] text-neutral-400 dark:text-neutral-500 ml-1.5 font-mono truncate">
                  {message.model}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
