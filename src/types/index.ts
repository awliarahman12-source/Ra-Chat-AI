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
 * url harus berupa Data URL (data:image/...;base64,xxx) atau URL publik.
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
// ATTACHMENT (untuk UI & storage, bukan untuk dikirim ke API)
// ============================================================

export interface Attachment {
  id: string;
  name: string;
  mimeType: string;      // contoh: "image/png"
  size: number;          // ukuran dalam bytes
  dataUrl: string;       // data:image/png;base64,....
}

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
   * Daftar attachment (gambar) yang dikirim user.
   * Dipakai untuk render preview di UI.
   * Format untuk API tetap diambil dari `content`.
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