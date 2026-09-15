// Same-origin proxy for AI provider requests.
//
// Many OpenAI-compatible providers (NVIDIA NIM, and others) don't send
// Access-Control-Allow-Origin headers, so a browser calling them directly
// gets blocked by CORS before the request even leaves the browser — this
// shows up client-side as a generic "Failed to fetch" with no useful detail.
//
// Since this function runs on Vercel (server-side), it isn't subject to the
// browser's CORS policy, so it can reach those providers on the client's
// behalf and stream the response straight back. The client only falls back
// to this proxy when a direct call fails at the network level — see
// `fetchWithCorsFallback` in src/api/chat.ts.
export const config = { runtime: 'edge' };

interface ProxyPayload {
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: { message: 'Method not allowed' } }), { status: 405 });
  }

  let payload: ProxyPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: { message: 'Invalid JSON body' } }), { status: 400 });
  }

  const { url, method = 'POST', headers = {}, body } = payload;

  if (!url || typeof url !== 'string') {
    return new Response(JSON.stringify({ error: { message: 'Missing target url' } }), { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return new Response(JSON.stringify({ error: { message: 'Invalid target url' } }), { status: 400 });
  }

  // Only ever forward to public https endpoints — never let this become an
  // open proxy for arbitrary/internal network requests.
  if (target.protocol !== 'https:') {
    return new Response(JSON.stringify({ error: { message: 'Only https target URLs are allowed' } }), { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(target.toString(), {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    return new Response(JSON.stringify({ error: { message: 'Proxy could not reach the target URL.' } }), { status: 502 });
  }

  // Stream the upstream response straight through (status + body), so SSE
  // streaming still works token-by-token instead of buffering.
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('Content-Type') || 'application/json',
    },
  });
}
