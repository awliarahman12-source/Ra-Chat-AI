import type { ToolDefinition } from '@/plugins/types';
import type { Message, Provider, AppSettings } from '@/types';

type MessageContentPart = Record<string, unknown>;

type ApiMessage = {
  role: string;
  content: string | MessageContentPart[];
};

interface ChatRequestOptions {
  messages: ApiMessage[];
  provider: Provider;
  model: string;
  settings: AppSettings;
  signal: AbortSignal;
  onToken: (token: string) => void;
}

function friendlyNetworkError(): Error {
  return new Error(
    'Network error: Unable to reach the AI provider. Check your internet connection or base URL.',
  );
}

async function fetchWithCorsFallback(
  url: string,
  options: RequestInit,
): Promise<Response> {
  try {
    return await fetch(url, options);
  } catch (error) {
    const signal = options.signal as AbortSignal | undefined;

    if (signal?.aborted) {
      throw error;
    }

    try {
      return await fetch('/api/ai-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          method: options.method || 'GET',
          headers: options.headers,
          body:
            typeof options.body === 'string'
              ? JSON.parse(options.body)
              : undefined,
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
    return new Error(
      'Authentication failed: Check your API key for this provider.',
    );
  }

  if (status === 429) {
    return new Error(
      'Rate limit exceeded: Too many requests. Please try again in a moment.',
    );
  }

  return new Error(fallback);
}

async function extractErrorMessage(
  response: Response,
  fallbackPrefix: string,
): Promise<string> {
  try {
    const errorData = await response.json();
    const message = errorData?.error?.message || errorData?.message;

    if (message) {
      return message;
    }
  } catch {
    try {
      const text = await response.text();

      if (text) {
        return text.slice(0, 300);
      }
    } catch {
      // Ignore malformed response errors.
    }
  }

  return `${fallbackPrefix} (status ${response.status})`;
}

function isContentParts(
  content: string | MessageContentPart[],
): content is MessageContentPart[] {
  return Array.isArray(content);
}

function getTextFromContent(
  content: string | MessageContentPart[],
): string {
  if (typeof content === 'string') {
    return content;
  }

  return content
    .filter((part) => part.type === 'text')
    .map((part) => String(part.text || ''))
    .join('\n');
}

function splitSystemPrompt(messages: ApiMessage[]) {
  const systemParts: string[] = [];
  const rest: ApiMessage[] = [];

  for (const message of messages) {
    if (message.role === 'system') {
      systemParts.push(getTextFromContent(message.content));
    } else {
      rest.push(message);
    }
  }

  return {
    system: systemParts.join('\n\n'),
    rest,
  };
}

function toAnthropicContent(
  content: string | MessageContentPart[],
): string | MessageContentPart[] {
  if (typeof content === 'string') {
    return content;
  }

  const parts: MessageContentPart[] = [];

  for (const part of content) {
    if (part.type === 'text' && typeof part.text === 'string') {
      parts.push({
        type: 'text',
        text: part.text,
      });
      continue;
    }

    if (
      part.type === 'image_url' &&
      typeof part.image_url === 'object' &&
      part.image_url !== null
    ) {
      const imageUrl = part.image_url as { url?: string };
      const dataUrl = imageUrl.url;

      if (!dataUrl || !dataUrl.startsWith('data:image/')) {
        continue;
      }

      const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);

      if (!match) {
        continue;
      }

      parts.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: match[1],
          data: match[2],
        },
      });
    }
  }

  return parts;
}

function toGeminiParts(
  content: string | MessageContentPart[],
): MessageContentPart[] {
  if (typeof content === 'string') {
    return [{ text: content }];
  }

  const parts: MessageContentPart[] = [];

  for (const part of content) {
    if (part.type === 'text' && typeof part.text === 'string') {
      parts.push({
        text: part.text,
      });
      continue;
    }

    if (
      part.type === 'image_url' &&
      typeof part.image_url === 'object' &&
      part.image_url !== null
    ) {
      const imageUrl = part.image_url as { url?: string };
      const dataUrl = imageUrl.url;

      if (!dataUrl || !dataUrl.startsWith('data:image/')) {
        continue;
      }

      const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);

      if (!match) {
        continue;
      }

      parts.push({
        inlineData: {
          mimeType: match[1],
          data: match[2],
        },
      });
    }
  }

  if (parts.length === 0) {
    return [{ text: 'Analyze the attached content.' }];
  }

  return parts;
}

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
    response = await fetchWithCorsFallback(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(provider.apiKey
          ? { Authorization: `Bearer ${provider.apiKey}` }
          : {}),
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (signal.aborted) {
      return;
    }

    throw error instanceof Error ? error : friendlyNetworkError();
  }

  if (!response.ok) {
    const message = await extractErrorMessage(response, 'Request failed');
    throw friendlyStatusError(response.status, message);
  }

  const reader = response.body?.getReader();

  if (!reader) {
    throw new Error('No response body received from the server.');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();

        if (!trimmed || !trimmed.startsWith('data:')) {
          continue;
        }

        const data = trimmed.slice(5).trim();

        if (data === '[DONE]') {
          return;
        }

        try {
          const parsed = JSON.parse(data);
          const token = parsed.choices?.[0]?.delta?.content;

          if (typeof token === 'string' && token) {
            onToken(token);
          }
        } catch {
          // Skip malformed streaming chunks.
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
    headers: provider.apiKey
      ? { Authorization: `Bearer ${provider.apiKey}` }
      : {},
  });

  if (!response.ok) {
    throw new Error(
      await extractErrorMessage(response, 'Failed to fetch models'),
    );
  }

  const data = await response.json();

  const models: string[] = (data.data || data.models || [])
    .map((model: { id?: string; name?: string }) => model.id || model.name || '')
    .filter(Boolean);

  return models.sort();
}

async function streamAnthropic(opts: ChatRequestOptions): Promise<void> {
  const { messages, provider, model, settings, signal, onToken } = opts;

  const url = `${provider.baseUrl.replace(/\/$/, '')}/messages`;

  const { system, rest } = splitSystemPrompt(messages);

  const body = {
    model,
    system: system || undefined,
    messages: rest.map((message) => ({
      role: message.role === 'assistant' ? 'assistant' : 'user',
      content: toAnthropicContent(message.content),
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
    if (signal.aborted) {
      return;
    }

    throw friendlyNetworkError();
  }

  if (!response.ok) {
    const message = await extractErrorMessage(response, 'Request failed');
    throw friendlyStatusError(response.status, message);
  }

  const reader = response.body?.getReader();

  if (!reader) {
    throw new Error('No response body received from the server.');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();

        if (!trimmed || !trimmed.startsWith('data:')) {
          continue;
        }

        const data = trimmed.slice(5).trim();

        if (!data) {
          continue;
        }

        let parsed:
          | {
              type?: string;
              delta?: {
                type?: string;
                text?: string;
              };
              error?: {
                message?: string;
              };
            }
          | null = null;

        try {
          parsed = JSON.parse(data);
        } catch {
          continue;
        }

        if (
          parsed?.type === 'content_block_delta' &&
          parsed.delta?.type === 'text_delta' &&
          parsed.delta.text
        ) {
          onToken(parsed.delta.text);
        }

        if (parsed?.type === 'error') {
          throw new Error(
            parsed.error?.message || 'Anthropic returned an error.',
          );
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

  if (!response.ok) {
    throw new Error(
      await extractErrorMessage(response, 'Failed to fetch models'),
    );
  }

  const data = await response.json();

  const models: string[] = (data.data || [])
    .map((model: { id?: string }) => model.id || '')
    .filter(Boolean);

  return models.sort();
}

async function streamGemini(opts: ChatRequestOptions): Promise<void> {
  const { messages, provider, model, settings, signal, onToken } = opts;

  const baseUrl = provider.baseUrl.replace(/\/$/, '');

  const url =
    `${baseUrl}/models/${model}:streamGenerateContent` +
    `?alt=sse&key=${encodeURIComponent(provider.apiKey)}`;

  const { system, rest } = splitSystemPrompt(messages);

  const body = {
    contents: rest.map((message) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: toGeminiParts(message.content),
    })),
    systemInstruction: system
      ? {
          parts: [{ text: system }],
        }
      : undefined,
    generationConfig: {
      temperature: settings.temperature,
      maxOutputTokens: settings.maxTokens,
    },
  };

  let response: Response;

  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch {
    if (signal.aborted) {
      return;
    }

    throw friendlyNetworkError();
  }

  if (!response.ok) {
    const message = await extractErrorMessage(response, 'Request failed');
    throw friendlyStatusError(response.status, message);
  }

  const reader = response.body?.getReader();

  if (!reader) {
    throw new Error('No response body received from the server.');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();

        if (!trimmed || !trimmed.startsWith('data:')) {
          continue;
        }

        const data = trimmed.slice(5).trim();

        if (!data) {
          continue;
        }

        try {
          const parsed = JSON.parse(data);
          const token =
            parsed.candidates?.[0]?.content?.parts?.[0]?.text;

          if (typeof token === 'string' && token) {
            onToken(token);
          }
        } catch {
          // Skip malformed streaming chunks.
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

async function fetchGeminiModels(provider: Provider): Promise<string[]> {
  const baseUrl = provider.baseUrl.replace(/\/$/, '');

  const url =
    `${baseUrl}/models` +
    `?key=${encodeURIComponent(provider.apiKey)}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      await extractErrorMessage(response, 'Failed to fetch models'),
    );
  }

  const data = await response.json();

  const models: string[] = (data.models || [])
    .map((model: { name?: string }) =>
      (model.name || '').replace(/^models\//, ''),
    )
    .filter(Boolean);

  return models.sort();
}

export async function streamChatCompletion(
  opts: ChatRequestOptions,
): Promise<void> {
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

export async function fetchProviderModels(
  provider: Provider,
): Promise<string[]> {
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
  systemPrompt: string,
): ApiMessage[] {
  const result: ApiMessage[] = [];

  if (systemPrompt.trim()) {
    result.push({
      role: 'system',
      content: systemPrompt,
    });
  }

  for (const message of messages) {
    if (message.error) {
      continue;
    }

    result.push({
      role: message.role,
      content: message.content,
    });
  }

  return result;
}