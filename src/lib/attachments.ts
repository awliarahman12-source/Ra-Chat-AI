import type {
  AttachmentValidationError,
  ChatAttachment,
} from "../types/attachment";

const MAX_FILES = 4;
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

const TEXT_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "application/javascript",
  "text/javascript",
  "application/typescript",
  "text/typescript",
  "text/html",
  "text/css",
  "application/xml",
  "text/xml",
]);

const TEXT_EXTENSIONS = new Set([
  "txt",
  "md",
  "markdown",
  "csv",
  "json",
  "js",
  "jsx",
  "ts",
  "tsx",
  "html",
  "css",
  "xml",
  "yml",
  "yaml",
  "py",
  "php",
  "sql",
]);

function getExtension(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

export function isImageFile(file: File): boolean {
  return IMAGE_TYPES.has(file.type);
}

export function isTextFile(file: File): boolean {
  return TEXT_TYPES.has(file.type) || TEXT_EXTENSIONS.has(getExtension(file.name));
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;

  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;

  return `${(kb / 1024).toFixed(1)} MB`;
}

export function validateAttachmentFiles(
  files: File[],
  existingCount: number,
): AttachmentValidationError[] {
  const errors: AttachmentValidationError[] = [];

  if (existingCount + files.length > MAX_FILES) {
    errors.push({
      fileName: "Lampiran",
      reason: `Maksimum ${MAX_FILES} file dalam satu pesan.`,
    });
  }

  for (const file of files) {
    if (file.size > MAX_FILE_SIZE) {
      errors.push({
        fileName: file.name,
        reason: "Ukuran file melebihi batas 5 MB.",
      });
      continue;
    }

    if (!isImageFile(file) && !isTextFile(file)) {
      errors.push({
        fileName: file.name,
        reason:
          "Format belum didukung. Gunakan gambar atau file teks/kode/CSV/JSON.",
      });
    }
  }

  return errors;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () =>
      reject(new Error(`Gagal membaca file gambar: ${file.name}`));

    reader.readAsDataURL(file);
  });
}

function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () =>
      reject(new Error(`Gagal membaca file teks: ${file.name}`));

    reader.readAsText(file);
  });
}

export async function createChatAttachment(
  file: File,
): Promise<ChatAttachment> {
  const id = crypto.randomUUID();

  if (isImageFile(file)) {
    const dataUrl = await readAsDataUrl(file);

    return {
      id,
      name: file.name,
      type: file.type,
      size: file.size,
      kind: "image",
      dataUrl,
      previewUrl: dataUrl,
    };
  }

  const textContent = await readAsText(file);

  return {
    id,
    name: file.name,
    type: file.type || "text/plain",
    size: file.size,
    kind: "text",
    textContent,
  };
}

export async function createChatAttachments(
  files: File[],
): Promise<ChatAttachment[]> {
  return Promise.all(files.map(createChatAttachment));
}