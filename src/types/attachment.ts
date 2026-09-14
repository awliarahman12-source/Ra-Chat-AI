export type AttachmentKind = "image" | "text";

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

export interface AttachmentValidationError {
  fileName: string;
  reason: string;
}