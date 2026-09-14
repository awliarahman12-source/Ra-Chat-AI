export type Role = 'user' | 'assistant' | 'system';

export interface ToolCall {
  id: string;
  toolName: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  toolName: string;
  result: unknown;
  error?: string;
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
  providerId?: string;
  model?: string;
  error?: boolean;

  // Plugin / Tool execution
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
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

export * from './attachment';