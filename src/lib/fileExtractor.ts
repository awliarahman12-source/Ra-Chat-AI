import JSZip from 'jszip';
import type { Attachment, ImageAttachment, TextAttachment } from '@/types';

// ============================================================
// KONFIGURASI
// ============================================================

export const MAX_FILE_SIZE = 10 * 1024 * 1024;       // 10MB per file
export const MAX_TEXT_LENGTH = 200 * 1024;           // 200KB teks hasil extract
const MAX_FILES_IN_ZIP = 50;                         // max 50 file per ZIP

/**
 * Ekstensi file yang dianggap sebagai teks (akan dibaca isinya).
 */
const TEXT_EXTENSIONS = new Set([
  '.txt', '.md', '.markdown', '.json', '.csv', '.tsv', '.xml', '.yml', '.yaml',
  '.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.py', '.rb', '.go', '.rs',
  '.java', '.c', '.cpp', '.cc', '.h', '.hpp', '.cs', '.php', '.swift', '.kt',
  '.scala', '.html', '.htm', '.css', '.scss', '.sass', '.less',
  '.sh', '.bash', '.zsh', '.ps1', '.bat', '.cmd',
  '.sql', '.graphql', '.gql', '.prisma',
  '.toml', '.ini', '.cfg', '.conf', '.env', '.properties',
  '.log', '.lock', '.gitignore', '.dockerignore',
]);

/**
 * Ekstensi binary yang harus di-skip saat extract ZIP.
 */
const BINARY_EXTENSIONS = new Set([
  '.exe', '.dll', '.so', '.dylib', '.bin', '.dat', '.class', '.o', '.obj',
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp', '.tiff',
  '.mp3', '.mp4', '.wav', '.ogg', '.flac', '.mov', '.avi', '.mkv', '.webm',
  '.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.ttf', '.otf', '.woff', '.woff2', '.eot',
  '.db', '.sqlite', '.sqlite3',
]);

// ============================================================
// RESULT TYPE
// ============================================================

export type ExtractResult =
  | { ok: true; attachment: Attachment }
  | { ok: false; error: string };

// ============================================================
// HELPERS
// ============================================================

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function getExtension(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx >= 0 ? name.slice(idx).toLowerCase() : '';
}

function isImage(name: string, mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

function isZip(name: string, mimeType: string): boolean {
  const ext = getExtension(name);
  return (
    ext === '.zip' ||
    mimeType === 'application/zip' ||
    mimeType === 'application/x-zip-compressed'
  );
}

function isText(name: string, mimeType: string): boolean {
  if (mimeType.startsWith('text/')) return true;
  if (
    mimeType === 'application/json' ||
    mimeType === 'application/javascript' ||
    mimeType === 'application/xml' ||
    mimeType === 'application/x-yaml'
  ) {
    return true;
  }
  return TEXT_EXTENSIONS.has(getExtension(name));
}

function readAsDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Gagal membaca file'));
    reader.readAsDataURL(file);
  });
}

function readAsText(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Gagal membaca file'));
    reader.readAsText(file);
  });
}

// ============================================================
// PROCESSOR: IMAGE
// ============================================================

async function processImage(file: File): Promise<ImageAttachment> {
  const dataUrl = await readAsDataUrl(file);
  return {
    id: generateId(),
    kind: 'image',
    name: file.name,
    mimeType: file.type || 'image/png',
    size: file.size,
    dataUrl,
  };
}

// ============================================================
// PROCESSOR: TEXT FILE
// ============================================================

async function processText(file: File): Promise<TextAttachment> {
  let text = await readAsText(file);
  let truncated = false;

  if (text.length > MAX_TEXT_LENGTH) {
    text = text.slice(0, MAX_TEXT_LENGTH);
    truncated = true;
  }

  return {
    id: generateId(),
    kind: 'text',
    name: file.name,
    mimeType: file.type || 'text/plain',
    size: file.size,
    extractedText: text,
    truncated,
  };
}

// ============================================================
// PROCESSOR: ZIP
// ============================================================

async function processZip(file: File): Promise<TextAttachment> {
  const zip = await JSZip.loadAsync(file);
  const entries = Object.values(zip.files).filter((f) => !f.dir);

  const includedFiles: string[] = [];
  const skippedFiles: string[] = [];
  const parts: string[] = [];

  let totalLength = 0;
  let truncated = false;

  for (const entry of entries) {
    if (includedFiles.length >= MAX_FILES_IN_ZIP) {
      skippedFiles.push(`${entry.name} (melebihi batas ${MAX_FILES_IN_ZIP} file)`);
      truncated = true;
      continue;
    }

    const ext = getExtension(entry.name);
    if (BINARY_EXTENSIONS.has(ext)) {
      skippedFiles.push(`${entry.name} (file binary)`);
      continue;
    }

    try {
      const text = await entry.async('string');
      const chunk = `\n===== ${entry.name} =====\n${text}\n`;

      if (totalLength + chunk.length > MAX_TEXT_LENGTH) {
        const remaining = MAX_TEXT_LENGTH - totalLength;
        if (remaining > 200) {
          parts.push(chunk.slice(0, remaining) + '\n...(terpotong)');
        }
        truncated = true;
        skippedFiles.push(`${entry.name} (terpotong karena limit)`);
        break;
      }

      parts.push(chunk);
      totalLength += chunk.length;
      includedFiles.push(entry.name);
    } catch {
      skippedFiles.push(`${entry.name} (gagal dibaca)`);
    }
  }

  // Susun header
  const header =
    `[Attachment: ${file.name}]\n` +
    `Total file di dalam ZIP: ${entries.length}\n` +
    `File teks yang disertakan: ${includedFiles.length}${truncated ? ' (sebagian terpotong)' : ''}\n`;

  let body = parts.join('');

  if (skippedFiles.length > 0) {
    body += `\n\n===== FILE YANG TIDAK DISERTAKAN =====\n`;
    body += skippedFiles.map((f) => `- ${f}`).join('\n');
  }

  return {
    id: generateId(),
    kind: 'text',
    name: file.name,
    mimeType: 'application/zip',
    size: file.size,
    extractedText: header + body,
    truncated,
    filesIncluded: includedFiles,
  };
}

// ============================================================
// MAIN: extractFile
// ============================================================

export async function extractFile(file: File): Promise<ExtractResult> {
  try {
    if (file.size > MAX_FILE_SIZE) {
      return {
        ok: false,
        error: `"${file.name}" terlalu besar (max 10MB)`,
      };
    }

    if (isImage(file.name, file.type)) {
      return { ok: true, attachment: await processImage(file) };
    }

    if (isZip(file.name, file.type)) {
      return { ok: true, attachment: await processZip(file) };
    }

    if (isText(file.name, file.type)) {
      return { ok: true, attachment: await processText(file) };
    }

    return {
      ok: false,
      error: `Tipe file "${file.name}" belum didukung. Coba gambar, ZIP, atau file teks/kode.`,
    };
  } catch (err) {
    return {
      ok: false,
      error: `Gagal memproses "${file.name}": ${err instanceof Error ? err.message : 'Unknown error'}`,
    };
  }
}

// ============================================================
// HELPER: BUILD TEXT BLOCK FROM ATTACHMENTS
// ============================================================

/**
 * Gabungin semua TextAttachment jadi satu blok teks yang dikirim ke AI
 * sebagai bagian dari pesan user.
 */
export function buildTextBlockFromAttachments(attachments: Attachment[]): string {
  const textAtts = attachments.filter(
    (a): a is TextAttachment => a.kind === 'text'
  );
  if (textAtts.length === 0) return '';

  return textAtts
    .map((att) => `\n\n===== ATTACHMENT: ${att.name} =====\n${att.extractedText}`)
    .join('');
}