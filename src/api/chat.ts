import type { Message, MessageContent, Provider, AppSettings, Role } from '@/types';

// ============================================================
// TYPES
// ============================================================

interface ChatRequestOptions {
  messages: { role: Role; content: MessageContent }[];
  provider: Provider;
  model: string;
  settings: AppSettings;
  signal: AbortSignal;
  onToken: (token: string) => void;
}

// ============================================================
// HELPERS
// ============================================================

function friendlyNetworkError(): Error {
  return new Error('Network error: Unable to reach the AI provider. Check your internet connection or base URL.');
}

/**
 * Parse a data URL (data:image/png;base64,xxx) into mimeType + base64.
 * Returns null kalau bukan data URL / formatnya nggak sesuai.
 */
function parseDataUrl(dataUrl: string): { mediaType: string; base64: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/s);
  if (!match) return null;
  return { mediaType: match[1], base64: match[2] };
}

/**
 * Ambil teks murni dari MessageContent (dipakai buat system prompt).
 */
function extractText(content: MessageContent): string {
  if (typeof content === 'string') return content;
  return content
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('\n');
}

/**
 * Cek apakah MessageContent punya minimal 1 gambar.
 */
function hasImages(content: MessageContent): boolean {
  return typeof content !== 'string' && content.some((p) => p.type === 'image_url');
}

/**
 * Calls `fetch` directly first. If that fails at the network level (which is
 * the symptom of a CORS block — the browser refuses to even send the
 * request), retries once through our own same-origin serverless proxy
 * (`/api/ai-proxy`, only present when deployed on Vercel). Real HTTP error
 * responses (401, 429, 500, ...) are NOT retried here — those come back as
 * normal Response objects, not thrown errors, so they skip straight to the
 * caller's own error handling.
 */
async function fetchWithCorsFallback(url: string, options: RequestInit): Promise<Response> {
  try {
    return await fetch(url, options);
  } catch (err) {
    const signal = options.signal as AbortSignal | undefined;
    if (signal?.aborted) throw err;

    try {
      return await fetch('/api/ai-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          method: options.method || 'GET',
          headers: options.headers,
          body: typeof options.body === 'string' ? JSON.parse(options.body) : undefined,
        }),
        signal,
      });
    } catch {
      throw friendlyNetworkError();
    }
  }
}

function friendlyStatusError(status: number, fallback: string): Error {
  if (status === 401 || status === 403) {
    return new Error('Authentication failed: Check your API key for this provider.');
  }
  if (status === 402) {
    return new Error('Insufficient credits. Please top up your account with the provider.');
  }
  if (status === 404 && /no endpoints found/i.test(fallback)) {
    return new Error(
      'Model yang dipilih tidak mendukung gambar. Coba ganti ke model multimodal (contoh: gpt-4o, claude-3.5-sonnet, gemini-flash-1.5).'
    );
  }
  if (status === 429) {
    return new Error('Rate limit exceeded: Too many requests. Please try again in a moment.');
  }
  return new Error(fallback);
}

async function extractErrorMessage(response: Response, fallbackPrefix: string): Promise<string> {
  try {
    const errorData = await response.json();
    const msg =
      errorData?.error?.message ||
      errorData?.error ||
      errorData?.message;
    if (typeof msg === 'string' && msg) return msg;
    if (msg) return JSON.stringify(msg);
  } catch {
    try {
      const text = await response.text();
      if (text) return text.slice(0, 300);
    } catch {
      // ignore
    }
  }
  return `${fallbackPrefix} (status ${response.status})`;
}

/**
 * Splits the OpenAI-style flat message list (which may include a leading
 * `system` message) into a system prompt string plus user/assistant turns.
 * System prompts are always treated as plain text.
 */
function splitSystemPrompt(messages: { role: Role; content: MessageContent }[]) {
  const systemParts: string[] = [];
  const rest: { role: Role; content: MessageContent }[] = [];
  for (const m of messages) {
    if (m.role === 'system') {
      systemParts.push(extractText(m.content));
    } else {
      rest.push(m);
    }
  }
  return { system: systemParts.join('\n\n'), rest };
}

// ============================================================
// OpenAI-compatible (OpenAI, OpenRouter, Groq, local LLM servers, etc.)
// ============================================================

async function streamOpenAI(opts: ChatRequestOptions): Promise<void> {
  const { messages, provider, model, settings, signal, onToken } = opts;
  const url = `${provider.baseUrl.replace(/\/$/, '')}/chat/completions`;

  const body = {
    model,
    messages,
    temperature: settings.temperature,
    max_tokens: settings.maxTokens,
    stream: true,
  };

  // OpenRouter recommends (but doesn't require) these headers.
  const extraHeaders: Record<string, string> =
    provider.type === 'openrouter'
      ? {
          'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'https://localhost',
          'X-Title': 'Ra-Chat-AI',
        }
      : {};

  let response: Response;
  try {
    response = await fetchWithCorsFallback(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : {}),
        ...extraHeaders,
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (signal.aborted) return;
    throw err instanceof Error ? err : friendlyNetworkError();
  }

  if (!response.ok) {
    const msg = await extractErrorMessage(response, 'Request failed');
    throw friendlyStatusError(response.status, msg);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body received from the server.');

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;

        const data = trimmed.slice(5).trim();
        if (data === '[DONE]') return;

        try {
          const parsed = JSON.parse(data);
          const token = parsed.choices?.[0]?.delta?.content;
          if (token) onToken(token);
        } catch {
          // Skip malformed chunks
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

async function fetchOpenAIModels(provider: Provider): Promise<string[]> {
  const url = `${provider.baseUrl.replace(/\/$/, '')}/models`;
  const response = await fetchWithCorsFallback(url, {
    headers: provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : {},
  });
  if (!response.ok) throw new Error(await extractErrorMessage(response, 'Failed to fetch models'));
  const data = await response.json();
  const models: string[] = (data.data || data.models || [])
    .map((m: { id?: string; name?: string }) => m.id || m.name || '')
    .filter(Boolean);
  return models.sort();
}

// ============================================================
// Anthropic (Claude)
// ============================================================

type AnthropicBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
  | { type: 'image'; source: { type: 'url'; url: string } };

/**
 * Konversi MessageContent → Anthropic content blocks.
 * - Text → { type: 'text', text }
 * - image_url dengan data URL → { type: 'image', source: { type:'base64', media_type, data } }
 * - image_url dengan URL biasa → { type: 'image', source: { type:'url', url } }
 */
function toAnthropicContent(content: MessageContent): string | AnthropicBlock[] {
  if (typeof content === 'string') return content;
  const blocks: AnthropicBlock[] = [];
  for (const part of content) {
    if (part.type === 'text') {
      if (part.text) blocks.push({ type: 'text', text: part.text });
    } else if (part.type === 'image_url') {
      const parsed = parseDataUrl(part.image_url.url);
      if (parsed) {
        blocks.push({
          type: 'image',
          source: { type: 'base64', media_type: parsed.mediaType, data: parsed.base64 },
        });
      } else {
        blocks.push({
          type: 'image',
          source: { type: 'url', url: part.image_url.url },
        });
      }
    }
  }
  return blocks;
}

async function streamAnthropic(opts: ChatRequestOptions): Promise<void> {
  const { messages, provider, model, settings, signal, onToken } = opts;
  const url = `${provider.baseUrl.replace(/\/$/, '')}/messages`;
  const { system, rest } = splitSystemPrompt(messages);

  const body = {
    model,
    system: system || undefined,
    messages: rest.map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: toAnthropicContent(m.content),
    })),
    temperature: settings.temperature,
    max_tokens: settings.maxTokens,
    stream: true,
  };

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': provider.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch {
    if (signal.aborted) return;
    throw friendlyNetworkError();
  }

  if (!response.ok) {
    const msg = await extractErrorMessage(response, 'Request failed');
    throw friendlyStatusError(response.status, msg);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body received from the server.');

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;

        const data = trimmed.slice(5).trim();
        if (!data) continue;

        let parsed: { type?: string; delta?: { type?: string; text?: string }; error?: { message?: string } } | null = null;
        try {
          parsed = JSON.parse(data);
        } catch {
          continue;
        }

        if (parsed?.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
          onToken(parsed.delta.text as string);
        } else if (parsed?.type === 'error') {
          throw new Error(parsed.error?.message || 'Anthropic returned an error.');
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

async function fetchAnthropicModels(provider: Provider): Promise<string[]> {
  const url = `${provider.baseUrl.replace(/\/$/, '')}/models`;
  const response = await fetch(url, {
    headers: {
      'x-api-key': provider.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
  });
  if (!response.ok) throw new Error(await extractErrorMessage(response, 'Failed to fetch models'));
  const data = await response.json();
  const models: string[] = (data.data || []).map((m: { id?: string }) => m.id || '').filter(Boolean);
  return models.sort();
}

// ============================================================
// Google Gemini
// ============================================================

type GeminiPart =
  | { text: string }
  | { inline_data: { mime_type: string; data: string } };

/**
 * Konversi MessageContent → Gemini parts.
 * Gemini pakai `inline_data` untuk gambar base64.
 * URL eksternal harus di-fetch dulu; untuk simplicity kita cuma support data URL.
 */
function toGeminiParts(content: MessageContent): GeminiPart[] {
  if (typeof content === 'string') return [{ text: content }];
  const parts: GeminiPart[] = [];
  for (const part of content) {
    if (part.type === 'text') {
      if (part.text) parts.push({ text: part.text });
    } else if (part.type === 'image_url') {
      const parsed = parseDataUrl(part.image_url.url);
      if (parsed) {
        parts.push({
          inline_data: { mime_type: parsed.mediaType, data: parsed.base64 },
        });
      }
      // URL biasa tidak didukung tanpa fetch manual — skip.
    }
  }
  return parts;
}

async function streamGemini(opts: ChatRequestOptions): Promise<void> {
  const { messages, provider, model, settings, signal, onToken } = opts;
  const base = provider.baseUrl.replace(/\/$/, '');
  const url = `${base}/models/${model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(provider.apiKey)}`;
  const { system, rest } = splitSystemPrompt(messages);

  const body = {
    contents: rest.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: toGeminiParts(m.content),
    })),
    systemInstruction: system ? { parts: [{ text: system }] } : undefined,
    generationConfig: {
      temperature: settings.temperature,
      maxOutputTokens: settings.maxTokens,
    },
  };

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  } catch {
    if (signal.aborted) return;
    throw friendlyNetworkError();
  }

  if (!response.ok) {
    const msg = await extractErrorMessage(response, 'Request failed');
    throw friendlyStatusError(response.status, msg);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body received from the server.');

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;

        const data = trimmed.slice(5).trim();
        if (!data) continue;

        try {
          const parsed = JSON.parse(data);
          const token = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
          if (token) onToken(token);
        } catch {
          // Skip malformed chunks
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

async function fetchGeminiModels(provider: Provider): Promise<string[]> {
  const base = provider.baseUrl.replace(/\/$/, '');
  const url = `${base}/models?key=${encodeURIComponent(provider.apiKey)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(await extractErrorMessage(response, 'Failed to fetch models'));
  const data = await response.json();
  const models: string[] = (data.models || [])
    .map((m: { name?: string }) => (m.name || '').replace(/^models\//, ''))
    .filter(Boolean);
  return models.sort();
}

// ============================================================
// Dispatcher
// ============================================================

export async function streamChatCompletion(opts: ChatRequestOptions): Promise<void> {
  switch (opts.provider.type) {
    case 'anthropic':
      return streamAnthropic(opts);
    case 'gemini':
      return streamGemini(opts);
    case 'openai':
    case 'openrouter':
    default:
      return streamOpenAI(opts);
  }
}

export async function fetchProviderModels(provider: Provider): Promise<string[]> {
  switch (provider.type) {
    case 'anthropic':
      return fetchAnthropicModels(provider);
    case 'gemini':
      return fetchGeminiModels(provider);
    case 'openai':
    case 'openrouter':
    default:
      return fetchOpenAIModels(provider);
  }
}

// ============================================================
// BUILD API MESSAGES
// ============================================================

export function buildApiMessages(
  messages: Message[],
  systemPrompt: string
): { role: Role; content: MessageContent }[] {
  const result: { role: Role; content: MessageContent }[] = [];
  if (systemPrompt.trim()) {
    result.push({ role: 'system', content: systemPrompt });
  }
  for (const msg of messages) {
    if (msg.error) continue;
    // Skip assistant messages that are still empty (mid-stream placeholder).
    if (msg.role === 'assistant' && typeof msg.content === 'string' && !msg.content.trim()) {
      continue;
    }
    result.push({ role: msg.role, content: msg.content });
  }
  return result;
}