export type Role = 'user' | 'assistant' | 'system';

// ============================================================
// MULTIMODAL CONTENT (Text + Image)
// ============================================================

/**
 * Bagian konten berupa teks (format OpenAI/OpenRouter).
 */
export interface TextContentPart {
  type: 'text';
  text: string;
}

/**
 * Bagian konten berupa gambar (format OpenAI/OpenRouter).
 */
export interface ImageContentPart {
  type: 'image_url';
  image_url: {
    url: string;
    detail?: 'auto' | 'low' | 'high';
  };
}

/**
 * Konten pesan bisa berupa string biasa (text-only)
 * atau array part (kalau ada gambar / multimodal).
 */
export type MessageContent = string | Array<TextContentPart | ImageContentPart>;

// ============================================================
// ATTACHMENT
// ============================================================

/**
 * Attachment berupa gambar. Dikirim ke API sebagai part `image_url`.
 */
export interface ImageAttachment {
  id: string;
  kind: 'image';
  name: string;
  mimeType: string;   // contoh: "image/png"
  size: number;       // ukuran dalam bytes
  dataUrl: string;    // data:image/png;base64,....
}

/**
 * Attachment berupa file teks / kode / hasil extract ZIP.
 * Isinya (extractedText) dikirim ke API sebagai bagian dari teks pesan.
 */
export interface TextAttachment {
  id: string;
  kind: 'text';
  name: string;
  mimeType: string;
  size: number;
  extractedText: string;      // isi teks setelah extract
  truncated?: boolean;        // true kalau terpotong karena limit
  filesIncluded?: string[];   // daftar file (khusus ZIP)
}

/**
 * Union: attachment bisa gambar ATAU teks.
 * Gunakan field `kind` untuk membedakan.
 */
export type Attachment = ImageAttachment | TextAttachment;

// ============================================================
// MESSAGE
// ============================================================

export interface Message {
  id: string;
  role: Role;
  content: MessageContent;
  createdAt: number;
  providerId?: string;
  model?: string;
  error?: boolean;

  /**
   * Daftar attachment yang dikirim user.
   * Dipakai untuk render preview di UI.
   */
  attachments?: Attachment[];
}

// ============================================================
// PROVIDER
// ============================================================

export type ProviderType = 'openai' | 'anthropic' | 'gemini' | 'openrouter';

export interface Provider {
  id: string;
  name: string;
  type: ProviderType;
  baseUrl: string;
  apiKey: string;
  models: string[];
  isActive: boolean;
  isDefault: boolean;
}

// ============================================================
// CONVERSATION
// ============================================================

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  providerId?: string;
  model?: string;
}

// ============================================================
// SETTINGS & TOAST
// ============================================================

export interface AppSettings {
  temperature: number;
  maxTokens: number;
  theme: 'light' | 'dark';
  systemPrompt: string;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}