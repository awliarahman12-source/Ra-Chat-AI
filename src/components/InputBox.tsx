import { useState, useRef, useEffect, useCallback } from 'react';
import {
  ArrowUp,
  Square,
  CornerDownLeft,
  Paperclip,
  X,
  FileText,
  Image as ImageIcon,
} from 'lucide-react';
import { useChatStore } from '@/store/chatStore';

type AttachmentKind = 'image' | 'text';

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

const MAX_FILES = 4;
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
]);

const TEXT_TYPES = new Set([
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
  'application/javascript',
  'text/javascript',
  'application/typescript',
  'text/typescript',
  'text/html',
  'text/css',
  'application/xml',
  'text/xml',
]);

const TEXT_EXTENSIONS = new Set([
  'txt',
  'md',
  'markdown',
  'csv',
  'json',
  'js',
  'jsx',
  'ts',
  'tsx',
  'py',
  'php',
  'sql',
  'html',
  'css',
  'xml',
  'yml',
  'yaml',
]);

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const kilobytes = bytes / 1024;

  if (kilobytes < 1024) {
    return `${kilobytes.toFixed(1)} KB`;
  }

  return `${(kilobytes / 1024).toFixed(1)} MB`;
}

function getFileExtension(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() ?? '';
}

function isImageFile(file: File): boolean {
  return IMAGE_TYPES.has(file.type);
}

function isTextFile(file: File): boolean {
  return TEXT_TYPES.has(file.type) || TEXT_EXTENSIONS.has(getFileExtension(file.name));
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Gagal membaca gambar: ${file.name}`));

    reader.readAsDataURL(file);
  });
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Gagal membaca file: ${file.name}`));

    reader.readAsText(file);
  });
}

async function convertFileToAttachment(file: File): Promise<ChatAttachment> {
  if (isImageFile(file)) {
    const dataUrl = await readFileAsDataUrl(file);

    return {
      id: crypto.randomUUID(),
      name: file.name,
      type: file.type,
      size: file.size,
      kind: 'image',
      dataUrl,
      previewUrl: dataUrl,
    };
  }

  const textContent = await readFileAsText(file);

  return {
    id: crypto.randomUUID(),
    name: file.name,
    type: file.type || 'text/plain',
    size: file.size,
    kind: 'text',
    textContent,
  };
}

export function InputBox() {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeConversationId = useChatStore((s) => s.activeConversationId);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const stopStreaming = useChatStore((s) => s.stopStreaming);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;

    if (!el) {
      return;
    }

    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [input, adjustHeight]);

  useEffect(() => {
    const isTouchDevice =
      typeof window !== 'undefined' &&
      (navigator.maxTouchPoints > 0 || 'ontouchstart' in window);

    if (!isTouchDevice) {
      textareaRef.current?.focus();
    }
  }, [activeConversationId]);

  const handleChooseFiles = () => {
    if (!isStreaming && attachments.length < MAX_FILES) {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const selectedFiles = Array.from(event.target.files ?? []);

    if (selectedFiles.length === 0) {
      return;
    }

    if (attachments.length + selectedFiles.length > MAX_FILES) {
      window.alert(`Maksimum ${MAX_FILES} file dapat dilampirkan dalam satu pesan.`);
      event.target.value = '';
      return;
    }

    const invalidFiles: string[] = [];

    for (const file of selectedFiles) {
      if (file.size > MAX_FILE_SIZE) {
        invalidFiles.push(`${file.name}: ukuran file melebihi 5 MB.`);
        continue;
      }

      if (!isImageFile(file) && !isTextFile(file)) {
        invalidFiles.push(
          `${file.name}: format belum didukung. Gunakan gambar atau file teks/kode.`,
        );
      }
    }

    if (invalidFiles.length > 0) {
      window.alert(invalidFiles.join('\n'));
      event.target.value = '';
      return;
    }

    try {
      const processedFiles = await Promise.all(
        selectedFiles.map(convertFileToAttachment),
      );

      setAttachments((current) => [...current, ...processedFiles]);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Gagal memproses lampiran.';

      window.alert(errorMessage);
    } finally {
      event.target.value = '';
    }
  };

  const handleRemoveAttachment = (attachmentId: string) => {
    setAttachments((current) =>
      current.filter((attachment) => attachment.id !== attachmentId),
    );
  };

  const handleSend = async () => {
    const content = input.trim();

    if ((!content && attachments.length === 0) || isStreaming) {
      return;
    }

    const attachmentsToSend = [...attachments];

    setInput('');
    setAttachments([]);

    try {
      await sendMessage(content, attachmentsToSend);
    } catch (error) {
      setInput(content);
      setAttachments(attachmentsToSend);

      console.error('Gagal mengirim pesan:', error);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  };

  return (
    <div className="px-3 sm:px-4 pb-safe pt-1 bg-gradient-to-t from-white dark:from-neutral-950 via-white dark:via-neutral-950 to-transparent">
      <div className="max-w-3xl mx-auto">
        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 px-3 py-2 focus-within:ring-2 focus-within:ring-neutral-300 dark:focus-within:ring-neutral-600 transition-all">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/png,image/jpeg,image/webp,image/gif,text/plain,text/markdown,text/csv,application/json,.txt,.md,.markdown,.csv,.json,.js,.jsx,.ts,.tsx,.py,.php,.sql,.html,.css,.xml,.yml,.yaml"
            className="hidden"
            onChange={handleFileChange}
            disabled={isStreaming}
          />

          {attachments.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="group relative flex max-w-[220px] items-center gap-2 rounded-xl border border-neutral-200 bg-white p-2 pr-8 dark:border-neutral-700 dark:bg-neutral-800"
                >
                  {attachment.kind === 'image' && attachment.previewUrl ? (
                    <img
                      src={attachment.previewUrl}
                      alt={attachment.name}
                      className="h-10 w-10 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500 dark:bg-neutral-700 dark:text-neutral-300">
                      <FileText className="h-5 w-5" />
                    </div>
                  )}

                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-neutral-800 dark:text-neutral-100">
                      {attachment.name}
                    </p>
                    <p className="text-[11px] text-neutral-400 dark:text-neutral-500">
                      {formatFileSize(attachment.size)}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveAttachment(attachment.id)}
                    disabled={isStreaming}
                    title={`Hapus ${attachment.name}`}
                    aria-label={`Hapus ${attachment.name}`}
                    className="absolute right-1 top-1 rounded-md p-1 text-neutral-400 transition-colors hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-500/20 dark:hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="relative flex items-end gap-2">
            <button
              type="button"
              onClick={handleChooseFiles}
              disabled={isStreaming || attachments.length >= MAX_FILES}
              title="Lampirkan gambar atau file teks"
              aria-label="Lampirkan file"
              className="mb-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-200 hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-100 disabled:cursor-not-allowed disabled:opacity-35"
            >
              <Paperclip className="h-4 w-4" />
            </button>

            <textarea
              ref={textareaRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Send a message..."
              rows={1}
              className="flex-1 resize-none bg-transparent py-1.5 text-sm text-neutral-800 placeholder:text-neutral-400 focus:outline-none max-h-[200px] sm:text-base dark:text-neutral-100"
              style={{ minHeight: '24px' }}
            />

            {isStreaming ? (
              <button
                type="button"
                onClick={stopStreaming}
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-neutral-200 transition-colors hover:bg-neutral-300 dark:bg-neutral-700 dark:hover:bg-neutral-600"
                title="Stop generating"
                aria-label="Stop generating"
              >
                <Square className="h-3.5 w-3.5 fill-current text-neutral-700 dark:text-neutral-200" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleSend()}
                disabled={!input.trim() && attachments.length === 0}
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-neutral-800 text-white transition-all hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-30 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
                title="Send message"
                aria-label="Send message"
              >
                <ArrowUp className="h-4.5 w-4.5" />
              </button>
            )}
          </div>
        </div>

        <div className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-neutral-400 dark:text-neutral-500">
          <CornerDownLeft className="h-3 w-3" />
          <span>to send</span>
          <span className="opacity-50">·</span>
          <span>Shift + Enter for new line</span>
          <span className="opacity-50">·</span>
          <ImageIcon className="h-3 w-3" />
          <span>Images and text files supported</span>
        </div>
      </div>
    </div>
  );
}