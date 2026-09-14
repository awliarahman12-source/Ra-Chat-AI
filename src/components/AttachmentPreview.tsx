import type { ChatAttachment } from "../types/attachment";
import { formatFileSize } from "../lib/attachments";

interface AttachmentPreviewProps {
  attachments: ChatAttachment[];
  onRemove: (attachmentId: string) => void;
  disabled?: boolean;
}

function FileIcon({ kind }: { kind: ChatAttachment["kind"] }) {
  if (kind === "image") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        className="h-5 w-5"
        aria-hidden="true"
      >
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <circle cx="8.5" cy="9" r="1.5" />
        <path d="m21 15-4.5-4.5L8 19" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6M8 13h8M8 17h6" />
    </svg>
  );
}

export default function AttachmentPreview({
  attachments,
  onRemove,
  disabled = false,
}: AttachmentPreviewProps) {
  if (attachments.length === 0) {
    return null;
  }

  return (
    <div
      className="mb-3 flex flex-wrap gap-2"
      aria-label="File yang akan dikirim"
    >
      {attachments.map((attachment) => (
        <div
          key={attachment.id}
          className="group relative flex max-w-[230px] items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-2 pr-8"
        >
          {attachment.kind === "image" && attachment.previewUrl ? (
            <img
              src={attachment.previewUrl}
              alt={attachment.name}
              className="h-10 w-10 rounded-lg object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10 text-slate-300">
              <FileIcon kind={attachment.kind} />
            </div>
          )}

          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-slate-100">
              {attachment.name}
            </p>
            <p className="text-[11px] text-slate-400">
              {formatFileSize(attachment.size)}
            </p>
          </div>

          <button
            type="button"
            onClick={() => onRemove(attachment.id)}
            disabled={disabled}
            aria-label={`Hapus ${attachment.name}`}
            className="absolute right-1 top-1 rounded-md p-1 text-slate-400 transition hover:bg-red-500/20 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-3.5 w-3.5"
              aria-hidden="true"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}