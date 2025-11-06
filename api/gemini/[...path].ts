export const config = {
  runtime: 'edge',
};

const DEFAULT_PROXY_BASE = (process.env.PROXY_GEMINI_BASE || process.env.GOOGLE_PROXY_BASE || 'https://key.lixining.com/proxy/google').replace(/\/$/, '');
const DEFAULT_API_KEY = (process.env.GEMINI_API_KEY || process.env.API_KEY || 'sk-lixining').trim();

function createCorsHeaders(request: Request): Headers {
  const origin = request.headers.get('origin') || '*';
  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  headers.set('Access-Control-Allow-Headers', request.headers.get('access-control-request-headers') || 'content-type,x-goog-api-key');
  headers.set('Access-Control-Expose-Headers', '*');
  headers.set('Vary', 'Origin');
  return headers;
}

function buildTargetUrl(requestUrl: URL): string {
  const pathSuffix = requestUrl.pathname.replace(/^\/api\/gemini/, '');
  const trimmedPath = pathSuffix.replace(/^\/+/g, '');
  const targetPath = trimmedPath ? `/${trimmedPath}` : '';
  const queryString = requestUrl.search || '';
  return `${DEFAULT_PROXY_BASE}${targetPath}${queryString}`;
}

function buildForwardHeaders(request: Request): Headers {
  const headers = new Headers(request.headers);

  headers.delete('host');
  headers.delete('connection');
  headers.delete('content-length');
  headers.delete('accept-encoding');

  const apiKey = headers.get('x-goog-api-key');
  if (!apiKey || apiKey.trim().length === 0) {
    headers.set('x-goog-api-key', DEFAULT_API_KEY);
  }

  return headers;
}

export default async function handler(request: Request): Promise<Response> {
  const corsHeaders = createCorsHeaders(request);

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const targetUrl = buildTargetUrl(new URL(request.url));
  const forwardHeaders = buildForwardHeaders(request);

  let response: Response;
  try {
    response = await fetch(targetUrl, {
      method: request.method,
      headers: forwardHeaders,
      body: request.body,
      redirect: 'follow',
    });
  } catch (error) {
    console.error('Gemini proxy network error:', error);
    const headers = new Headers(corsHeaders);
    headers.set('Content-Type', 'application/json');
    return new Response(JSON.stringify({ error: 'Failed to contact Gemini proxy.' }), {
      status: 502,
      headers,
    });
  }

  const responseHeaders = new Headers(response.headers);
  corsHeaders.forEach((value, key) => {
    responseHeaders.set(key, value);
  });
  responseHeaders.delete('content-length');

  return new Response(response.body, {
    status: response.status,
    headers: responseHeaders,
  });
}
