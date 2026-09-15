import { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowUp, Square, CornerDownLeft, Paperclip, X, Loader2 } from 'lucide-react';
import { useChatStore } from '@/store/chatStore';
import type { Attachment } from '@/types';

const MAX_FILES = 5;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export function InputBox() {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Auto-clear error setelah 4 detik
  useEffect(() => {
    if (!fileError) return;
    const t = setTimeout(() => setFileError(null), 4000);
    return () => clearTimeout(t);
  }, [fileError]);

  useEffect(() => {
    const isTouchDevice =
      typeof window !== 'undefined' && (navigator.maxTouchPoints > 0 || 'ontouchstart' in window);
    if (!isTouchDevice) {
      textareaRef.current?.focus();
    }
  }, [activeConversationId]);

  // ============================================================
  // FILE HANDLING
  // ============================================================

  const fileToAttachment = (file: File): Promise<Attachment> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: file.name,
          mimeType: file.type,
          size: file.size,
          dataUrl: reader.result as string,
        });
      };
      reader.onerror = () => reject(new Error('Gagal membaca file'));
      reader.readAsDataURL(file);
    });
  };

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setFileError(null);
    setIsProcessingFiles(true);

    try {
      const incoming = Array.from(files);

      // Validasi: hanya gambar
      const nonImage = incoming.find((f) => !f.type.startsWith('image/'));
      if (nonImage) {
        setFileError(`"${nonImage.name}" bukan file gambar.`);
        return;
      }

      // Validasi: ukuran
      const tooBig = incoming.find((f) => f.size > MAX_FILE_SIZE);
      if (tooBig) {
        setFileError(`"${tooBig.name}" terlalu besar (max 5MB).`);
        return;
      }

      // Validasi: jumlah total
      const remaining = MAX_FILES - attachments.length;
      if (remaining <= 0) {
        setFileError(`Maksimal ${MAX_FILES} gambar.`);
        return;
      }

      const toProcess = incoming.slice(0, remaining);
      if (incoming.length > remaining) {
        setFileError(`Hanya ${remaining} gambar yang ditambahkan (max ${MAX_FILES}).`);
      }

      const processed = await Promise.all(toProcess.map(fileToAttachment));
      setAttachments((prev) => [...prev, ...processed]);
    } catch (err) {
      setFileError('Gagal memproses file. Coba lagi.');
      console.error(err);
    } finally {
      setIsProcessingFiles(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  // ============================================================
  // SEND
  // ============================================================

  const handleSend = () => {
    if (isStreaming) return;
    if (!input.trim() && attachments.length === 0) return;

    const content = input;
    const files = attachments;

    setInput('');
    setAttachments([]);
    sendMessage(content, files);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = (input.trim().length > 0 || attachments.length > 0) && !isStreaming;

  return (
    <div className="px-3 sm:px-4 pb-safe pt-1 bg-gradient-to-t from-white dark:from-neutral-950 via-white dark:via-neutral-950 to-transparent">
      <div className="max-w-3xl mx-auto">

        {/* Error message */}
        {fileError && (
          <div className="mb-2 text-xs text-red-500 dark:text-red-400 px-1">
            {fileError}
          </div>
        )}

        {/* Attachment previews */}
        {attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {attachments.map((att) => (
              <div
                key={att.id}
                className="relative group w-16 h-16 rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800"
              >
                <img
                  src={att.dataUrl}
                  alt={att.name}
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => handleRemoveAttachment(att.id)}
                  className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Hapus"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="relative flex items-end gap-2 rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 px-3 py-2 focus-within:ring-2 focus-within:ring-neutral-300 dark:focus-within:ring-neutral-600 transition-all">

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => handleFilesSelected(e.target.files)}
            className="hidden"
          />

          {/* Attach button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isStreaming || isProcessingFiles}
            className="flex-shrink-0 w-8 h-8 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Lampirkan gambar"
          >
            {isProcessingFiles ? (
              <Loader2 className="w-4 h-4 animate-spin text-neutral-500" />
            ) : (
              <Paperclip className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
            )}
          </button>

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
              disabled={!canSend}
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