export const config = { runtime: 'edge' };

interface ProxyPayload {
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
}

const ALLOWED_HOSTS = new Set([
  'api.openai.com',
  'openrouter.ai',
  'api.groq.com',
  'integrate.api.nvidia.com',
  'api.deepseek.com',
  'api.together.xyz',
  'api.mistral.ai',
  'api.perplexity.ai',
  'api.fireworks.ai',
  'api.cerebras.ai',
  'api.sambanova.ai',
]);

const ALLOWED_METHODS = new Set(['GET', 'POST']);

function jsonResponse(status: number, message: string): Response {
  return new Response(
    JSON.stringify({
      error: {
        message,
      },
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
    },
  );
}

function isAllowedTarget(target: URL): boolean {
  if (target.protocol !== 'https:') {
    return false;
  }

  if (ALLOWED_HOSTS.has(target.hostname)) {
    return true;
  }

  return (
    target.hostname.endsWith('.openai.azure.com') ||
    target.hostname.endsWith('.inference.ai.azure.com')
  );
}

function sanitizeHeaders(
  input: Record<string, string>,
): Record<string, string> {
  const allowedHeaders = new Set([
    'authorization',
    'content-type',
    'accept',
    'anthropic-version',
    'x-api-key',
    'anthropic-dangerous-direct-browser-access',
    'http-referer',
    'x-title',
  ]);

  const headers: Record<string, string> = {};

  for (const [key, value] of Object.entries(input)) {
    const normalizedKey = key.toLowerCase();

    if (
      allowedHeaders.has(normalizedKey) &&
      typeof value === 'string' &&
      value.length <= 10_000
    ) {
      headers[key] = value;
    }
  }

  return headers;
}

function validateContentPart(part: unknown): boolean {
  if (!part || typeof part !== 'object') {
    return false;
  }

  const contentPart = part as Record<string, unknown>;

  if (
    contentPart.type === 'text' &&
    typeof contentPart.text === 'string' &&
    contentPart.text.length <= 100_000
  ) {
    return true;
  }

  if (
    contentPart.type === 'image_url' &&
    typeof contentPart.image_url === 'object' &&
    contentPart.image_url !== null
  ) {
    const imageUrl = contentPart.image_url as Record<string, unknown>;
    const url = imageUrl.url;

    if (typeof url !== 'string') {
      return false;
    }

    if (!url.startsWith('data:image/')) {
      return false;
    }

    if (url.length > 8_000_000) {
      return false;
    }

    return /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=\s]+$/.test(
      url,
    );
  }

  return false;
}

function validateMessages(body: unknown): string | null {
  if (!body || typeof body !== 'object') {
    return 'Request body must be an object.';
  }

  const requestBody = body as Record<string, unknown>;

  if (!Array.isArray(requestBody.messages)) {
    return null;
  }

  if (requestBody.messages.length > 100) {
    return 'Maximum 100 messages per request.';
  }

  for (const message of requestBody.messages) {
    if (!message || typeof message !== 'object') {
      return 'Invalid message format.';
    }

    const item = message as Record<string, unknown>;

    if (
      typeof item.role !== 'string' ||
      !['system', 'user', 'assistant', 'tool'].includes(item.role)
    ) {
      return 'Invalid message role.';
    }

    if (typeof item.content === 'string') {
      if (item.content.length > 100_000) {
        return 'Message content is too long.';
      }

      continue;
    }

    if (Array.isArray(item.content)) {
      if (item.content.length > 12) {
        return 'Too many content parts in one message.';
      }

      for (const part of item.content) {
        if (!validateContentPart(part)) {
          return 'Invalid multimodal content part.';
        }
      }

      continue;
    }

    return 'Invalid message content.';
  }

  return null;
}

function validateProxyBody(body: unknown): string | null {
  if (body === undefined) {
    return null;
  }

  const serializedBody = JSON.stringify(body);

  if (serializedBody.length > 10_000_000) {
    return 'Request payload is too large.';
  }

  return validateMessages(body);
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return jsonResponse(405, 'Method not allowed.');
  }

  let payload: ProxyPayload;

  try {
    payload = await req.json();
  } catch {
    return jsonResponse(400, 'Invalid JSON body.');
  }

  const {
    url,
    method = 'POST',
    headers = {},
    body,
  } = payload;

  if (!url || typeof url !== 'string') {
    return jsonResponse(400, 'Missing target URL.');
  }

  if (!ALLOWED_METHODS.has(method.toUpperCase())) {
    return jsonResponse(405, 'Only GET and POST methods are allowed.');
  }

  let target: URL;

  try {
    target = new URL(url);
  } catch {
    return jsonResponse(400, 'Invalid target URL.');
  }

  if (!isAllowedTarget(target)) {
    return jsonResponse(
      403,
      `This AI provider host is not allowed: ${target.hostname}`,
    );
  }

  if (!headers || typeof headers !== 'object' || Array.isArray(headers)) {
    return jsonResponse(400, 'Invalid request headers.');
  }

  const bodyValidationError = validateProxyBody(body);

  if (bodyValidationError) {
    return jsonResponse(400, bodyValidationError);
  }

  const safeHeaders = sanitizeHeaders(headers);

  let upstream: Response;

  try {
    upstream = await fetch(target.toString(), {
      method: method.toUpperCase(),
      headers: {
        Accept: safeHeaders.Accept || safeHeaders.accept || 'text/event-stream, application/json',
        'Content-Type':
          safeHeaders['Content-Type'] ||
          safeHeaders['content-type'] ||
          'application/json',
        ...safeHeaders,
      },
      body:
        method.toUpperCase() === 'GET' || body === undefined
          ? undefined
          : JSON.stringify(body),
    });
  } catch {
    return jsonResponse(502, 'Proxy could not reach the target AI provider.');
  }

  const responseHeaders = new Headers();

  const contentType =
    upstream.headers.get('Content-Type') ||
    'application/json; charset=utf-8';

  responseHeaders.set('Content-Type', contentType);
  responseHeaders.set('Cache-Control', 'no-store');

  const cacheControl = upstream.headers.get('Cache-Control');

  if (cacheControl) {
    responseHeaders.set('Cache-Control', cacheControl);
  }

  const requestId =
    upstream.headers.get('x-request-id') ||
    upstream.headers.get('request-id');

  if (requestId) {
    responseHeaders.set('x-upstream-request-id', requestId);
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}