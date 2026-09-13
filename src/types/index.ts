export type Role = 'user' | 'assistant' | 'system';

export interface Message {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
  providerId?: string;
  model?: string;
  error?: boolean;
}

export type ProviderType = 'openai' | 'anthropic' | 'gemini';

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

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  providerId?: string;
  model?: string;
}

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
