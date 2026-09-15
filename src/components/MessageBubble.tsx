import { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { Copy, Check, AlertCircle, FileText, ChevronDown, ChevronRight } from 'lucide-react';
import type { Message, MessageContent, Attachment } from '@/types';

interface MessageBubbleProps {
  message: Message;
}

// ============================================================
// EXTRACT DISPLAY TEXT FROM CONTENT
// ============================================================

function getDisplayText(content: MessageContent): string {
  if (typeof content === 'string') return content;
  return content
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('\n');
}

function getImagesFromContent(content: MessageContent): string[] {
  if (typeof content === 'string') return [];
  return content
    .filter((p): p is { type: 'image_url'; image_url: { url: string } } => p.type === 'image_url')
    .map((p) => p.image_url.url);
}

// ============================================================
// FORMAT HELPER
// ============================================================

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ============================================================
// ATTACHMENT CARD (untuk file non-gambar)
// ============================================================

function AttachmentCard({ att }: { att: Attachment }) {
  const [expanded, setExpanded] = useState(false);

  if (att.kind === 'image') {
    return (
      <a
        href={att.dataUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-700 hover:ring-2 hover:ring-blue-400 transition-all"
        title={`${att.name} · ${formatSize(att.size)}`}
      >
        <img
          src={att.dataUrl}
          alt={att.name}
          className="max-w-[240px] max-h-[240px] object-cover"
        />
      </a>
    );
  }

  // TextAttachment
  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 overflow-hidden max-w-[420px]">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-2.5 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-left"
      >
        <div className="flex-shrink-0 w-7 h-7 rounded-md bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
          <FileText className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-medium text-neutral-800 dark:text-neutral-100 truncate">
            {att.name}
          </div>
          <div className="text-[10px] text-neutral-500 dark:text-neutral-400">
            {formatSize(att.size)}
            {att.filesIncluded && ` · ${att.filesIncluded.length} file`}
            {att.truncated && ' · terpotong'}
          </div>
        </div>
        {expanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-neutral-200 dark:border-neutral-700 max-h-[300px] overflow-y-auto">
          <pre className="text-[11px] p-2.5 text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap break-words font-mono">
            {att.extractedText}
          </pre>
        </div>
      )}
    </div>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export function MessageBubble({ message }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);

  const isUser = message.role === 'user';
  const displayText = useMemo(() => getDisplayText(message.content), [message.content]);
  const inlineImages = useMemo(() => getImagesFromContent(message.content), [message.content]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(displayText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  // ============================================================
  // USER MESSAGE
  // ============================================================
  if (isUser) {
    const hasAttachments = message.attachments && message.attachments.length > 0;

    return (
      <div className="flex justify-end gap-3 group">
        <div className="max-w-[80%] flex flex-col items-end gap-2">
          {/* Attachment previews */}
          {hasAttachments && (
            <div className="flex flex-wrap gap-2 justify-end">
              {message.attachments!.map((att) => (
                <AttachmentCard key={att.id} att={att} />
              ))}
            </div>
          )}

          {/* Text bubble */}
          {displayText && (
            <div className="rounded-2xl rounded-br-md bg-neutral-800 dark:bg-neutral-100 text-white dark:text-neutral-900 px-4 py-2.5 text-sm sm:text-base whitespace-pre-wrap break-words">
              {displayText}
            </div>
          )}

          {/* Copy button (hover) */}
          {displayText && (
            <button
              onClick={handleCopy}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-[11px] text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 flex items-center gap-1"
              title="Copy"
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          )}
        </div>
      </div>
    );
  }

  // ============================================================
  // ASSISTANT MESSAGE
  // ============================================================

  // Error state
  if (message.error) {
    return (
      <div className="flex gap-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
          <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="rounded-2xl rounded-tl-md bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 px-4 py-2.5 text-sm text-red-700 dark:text-red-300">
            {displayText || 'An error occurred.'}
          </div>
          {message.model && (
            <div className="text-[10px] text-neutral-400 mt-1">{message.model}</div>
          )}
        </div>
      </div>
    );
  }

  // Normal assistant message
  return (
    <div className="flex gap-3 group">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-teal-400 to-blue-500 flex items-center justify-center">
        <span className="text-white text-xs font-semibold">AI</span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-pre:my-2 prose-pre:bg-neutral-100 dark:prose-pre:bg-neutral-900 prose-code:text-[13px]">
          {displayText ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={{
                a: ({ node, ...props }) => (
                  <a {...props} target="_blank" rel="noopener noreferrer" />
                ),
              }}
            >
              {displayText}
            </ReactMarkdown>
          ) : (
            <span className="inline-block w-2 h-4 bg-neutral-400 dark:bg-neutral-600 animate-pulse align-middle" />
          )}
        </div>

        {/* Inline images (dari history kalau ada) */}
        {inlineImages.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {inlineImages.map((url, i) => (
              <img
                key={i}
                src={url}
                alt={`attachment-${i}`}
                className="max-w-[200px] rounded-lg border border-neutral-200 dark:border-neutral-700"
              />
            ))}
          </div>
        )}

        {/* Meta: model + copy */}
        <div className="flex items-center gap-3 mt-1.5">
          {message.model && (
            <span className="text-[10px] text-neutral-400">{message.model}</span>
          )}
          {displayText && (
            <button
              onClick={handleCopy}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-[11px] text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 flex items-center gap-1"
              title="Copy"
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}