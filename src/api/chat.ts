import type { Message, Provider, AppSettings } from '@/types';

interface ChatRequestOptions {
  messages: { role: string; content: string }[];
  provider: Provider;
  model: string;
  settings: AppSettings;
  signal: AbortSignal;
  onToken: (token: string) => void;
}

function friendlyNetworkError(): Error {
  return new Error('Network error: Unable to reach the AI provider. Check your internet connection or base URL.');
}

function friendlyStatusError(status: number, fallback: string): Error {
  if (status === 401 || status === 403) {
    return new Error('Authentication failed: Check your API key for this provider.');
  }
  if (status === 429) {
    return new Error('Rate limit exceeded: Too many requests. Please try again in a moment.');
  }
  return new Error(fallback);
}

async function extractErrorMessage(response: Response, fallbackPrefix: string): Promise<string> {
  try {
    const errorData = await response.json();
    const msg = errorData?.error?.message || errorData?.message;
    if (msg) return msg;
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
 * Anthropic and Gemini both require the system prompt to be passed
 * separately rather than as a message with role "system".
 */
function splitSystemPrompt(messages: { role: string; content: string }[]) {
  const systemParts: string[] = [];
  const rest: { role: string; content: string }[] = [];
  for (const m of messages) {
    if (m.role === 'system') {
      systemParts.push(m.content);
    } else {
      rest.push(m);
    }
  }
  return { system: systemParts.join('\n\n'), rest };
}

// ---------- OpenAI-compatible (OpenAI, OpenRouter, Groq, local LLM servers, etc.) ----------

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

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : {}),
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
  const response = await fetch(url, {
    headers: provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : {},
  });
  if (!response.ok) throw new Error(await extractErrorMessage(response, 'Failed to fetch models'));
  const data = await response.json();
  const models: string[] = (data.data || data.models || [])
    .map((m: { id?: string; name?: string }) => m.id || m.name || '')
    .filter(Boolean);
  return models.sort();
}

// ---------- Anthropic (Claude) ----------

async function streamAnthropic(opts: ChatRequestOptions): Promise<void> {
  const { messages, provider, model, settings, signal, onToken } = opts;
  const url = `${provider.baseUrl.replace(/\/$/, '')}/messages`;
  const { system, rest } = splitSystemPrompt(messages);

  const body = {
    model,
    system: system || undefined,
    messages: rest.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
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
          continue; // Skip malformed / non-JSON chunks
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

// ---------- Google Gemini ----------

async function streamGemini(opts: ChatRequestOptions): Promise<void> {
  const { messages, provider, model, settings, signal, onToken } = opts;
  const base = provider.baseUrl.replace(/\/$/, '');
  const url = `${base}/models/${model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(provider.apiKey)}`;
  const { system, rest } = splitSystemPrompt(messages);

  const body = {
    contents: rest.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
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

// ---------- Dispatcher ----------

export async function streamChatCompletion(opts: ChatRequestOptions): Promise<void> {
  switch (opts.provider.type) {
    case 'anthropic':
      return streamAnthropic(opts);
    case 'gemini':
      return streamGemini(opts);
    case 'openai':
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
    default:
      return fetchOpenAIModels(provider);
  }
}

export function buildApiMessages(
  messages: Message[],
  systemPrompt: string
): { role: string; content: string }[] {
  const result: { role: string; content: string }[] = [];
  if (systemPrompt.trim()) {
    result.push({ role: 'system', content: systemPrompt });
  }
  for (const msg of messages) {
    if (msg.error) continue;
    result.push({ role: msg.role, content: msg.content });
  }
  return result;
}
