const DEFAULT_PROXY_BASE = (process.env.PROXY_GEMINI_BASE || process.env.GOOGLE_PROXY_BASE || 'https://key.lixining.com/proxy/google').replace(/\/$/, '');
const DEFAULT_API_KEY = (process.env.GEMINI_API_KEY || process.env.API_KEY || 'sk-lixining').trim();

const ALLOWED_METHODS = 'GET,POST,PUT,PATCH,DELETE,OPTIONS';

function buildTargetUrl(req: any): string {
  const pathParam = req.query?.path;
  const segments = Array.isArray(pathParam)
    ? pathParam
    : typeof pathParam === 'string'
      ? [pathParam]
      : [];

  const query = new URLSearchParams();
  const queryEntries = req.query ? Object.entries(req.query) : [];
  for (const [key, value] of queryEntries) {
    if (key === 'path') continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== undefined) {
          query.append(key, String(item));
        }
      }
    } else if (value !== undefined) {
      query.append(key, String(value));
    }
  }

  const pathSuffix = segments.join('/');
  const queryString = query.toString();
  const targetPath = pathSuffix ? `/${pathSuffix}` : '';
  const targetQuery = queryString ? `?${queryString}` : '';

  return `${DEFAULT_PROXY_BASE}${targetPath}${targetQuery}`;
}

function applyCorsHeaders(res: any, req: any) {
  res.setHeader('Access-Control-Allow-Origin', req.headers?.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', ALLOWED_METHODS);
  res.setHeader(
    'Access-Control-Allow-Headers',
    req.headers?.['access-control-request-headers'] || 'content-type,x-goog-api-key'
  );
  res.setHeader('Access-Control-Expose-Headers', '*');
}

function buildForwardHeaders(req: any): Headers {
  const headers = new Headers();
  const incoming = req.headers ? Object.entries(req.headers) : [];

  for (const [key, value] of incoming) {
    if (!value) continue;
    if (key.toLowerCase() === 'host' || key.toLowerCase() === 'connection') continue;
    if (Array.isArray(value)) {
      headers.set(key, value.join(','));
    } else {
      headers.set(key, value);
    }
  }

  const apiKey = headers.get('x-goog-api-key');
  if (!apiKey || apiKey.trim().length === 0) {
    headers.set('x-goog-api-key', DEFAULT_API_KEY);
  }

  headers.delete('content-length');

  return headers;
}

function resolveBody(req: any, headers: Headers): BodyInit | undefined {
  const method = req.method?.toUpperCase();
  if (!method || method === 'GET' || method === 'HEAD') {
    return undefined;
  }

  const body = req.body;

  if (body === undefined || body === null) {
    return undefined;
  }

  if (typeof body === 'string' || body instanceof Buffer || body instanceof Uint8Array) {
    return body as BodyInit;
  }

  if (!headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  return JSON.stringify(body);
}

async function pipeResponse(stream: ReadableStream<Uint8Array> | null, res: any) {
  if (!stream) {
    res.end();
    return;
  }

  const reader = stream.getReader();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        res.write(Buffer.from(value));
      }
    }
  } finally {
    reader.releaseLock();
  }
  res.end();
}

export default async function handler(req: any, res: any) {
  applyCorsHeaders(res, req);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const targetUrl = buildTargetUrl(req);
  const headers = buildForwardHeaders(req);
  const body = resolveBody(req, headers);

  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
      redirect: 'follow',
    });

    res.status(response.status);
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === 'content-length') return;
      res.setHeader(key, value);
    });
    applyCorsHeaders(res, req);

    if (!response.body) {
      const buffer = Buffer.from(await response.arrayBuffer());
      res.end(buffer);
      return;
    }

    await pipeResponse(response.body, res);
  } catch (error: any) {
    console.error('Gemini proxy error:', error);
    res.status(502);
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Failed to contact Gemini proxy.' }));
  }
}
