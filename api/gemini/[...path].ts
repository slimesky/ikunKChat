import { Buffer } from 'node:buffer';
import type { IncomingMessage, ServerResponse } from 'node:http';

type VercelRequest = IncomingMessage & {
  cookies?: Record<string, string>;
  query?: Record<string, string | string[]>;
  body?: unknown;
};

type VercelResponse = ServerResponse & {
  status?: (statusCode: number) => VercelResponse;
  json?: (body: unknown) => void;
};

const DEFAULT_PROXY_BASE = (process.env.PROXY_GEMINI_BASE || process.env.GOOGLE_PROXY_BASE || 'https://key.lixining.com/proxy/google').replace(/\/$/, '');
const DEFAULT_API_KEY = (process.env.GEMINI_API_KEY || process.env.API_KEY || 'sk-lixining').trim();

function buildCorsHeaders(request: VercelRequest): Record<string, string> {
  const originHeader = request.headers.origin;
  const resolvedOrigin = Array.isArray(originHeader) ? originHeader[0] : originHeader || '*';
  const requestedHeaders = request.headers['access-control-request-headers'];
  const allowHeaders = Array.isArray(requestedHeaders)
    ? requestedHeaders.join(',')
    : requestedHeaders || 'content-type,x-goog-api-key';

  return {
    'Access-Control-Allow-Origin': resolvedOrigin,
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': allowHeaders,
    'Access-Control-Expose-Headers': '*',
    Vary: 'Origin, Access-Control-Request-Headers',
  };
}

function buildTargetUrl(request: VercelRequest): string {
  const url = new URL(request.url ?? '', `https://${request.headers.host || 'localhost'}`);
  const pathSuffix = url.pathname.replace(/^\/api\/gemini/, '');
  const trimmedPath = pathSuffix.replace(/^\/+/g, '');
  const targetPath = trimmedPath ? `/${trimmedPath}` : '';
  return `${DEFAULT_PROXY_BASE}${targetPath}${url.search}`;
}

function buildForwardHeaders(request: VercelRequest): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (!value) continue;
    if (['host', 'connection', 'content-length', 'accept-encoding'].includes(key.toLowerCase())) {
      continue;
    }
    const headerValue = Array.isArray(value) ? value.join(',') : value;
    headers.set(key, headerValue);
  }

  const apiKey = headers.get('x-goog-api-key');
  if (!apiKey || apiKey.trim().length === 0) {
    headers.set('x-goog-api-key', DEFAULT_API_KEY);
  }

  return headers;
}

async function readRequestBody(request: VercelRequest): Promise<Uint8Array | undefined> {
  if (!request.method || ['GET', 'HEAD'].includes(request.method.toUpperCase())) {
    return undefined;
  }

  const chunks: Uint8Array[] = [];
  for await (const chunk of request) {
    if (typeof chunk === 'string') {
      chunks.push(Buffer.from(chunk));
    } else {
      chunks.push(Buffer.from(chunk));
    }
  }

  if (chunks.length === 0) {
    return undefined;
  }

  return Buffer.concat(chunks);
}

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  const corsHeaders = buildCorsHeaders(request);
  for (const [key, value] of Object.entries(corsHeaders)) {
    response.setHeader(key, value);
  }

  if (request.method === 'OPTIONS') {
    response.statusCode = 204;
    response.end();
    return;
  }

  const targetUrl = buildTargetUrl(request);
  const forwardHeaders = buildForwardHeaders(request);
  const body = await readRequestBody(request);

  let upstream: globalThis.Response;
  try {
    upstream = await fetch(targetUrl, {
      method: request.method,
      headers: forwardHeaders,
      body,
      redirect: 'follow',
    });
  } catch (error) {
    console.error('Gemini proxy network error:', error);
    response.statusCode = 502;
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ error: 'Failed to contact Gemini proxy.' }));
    return;
  }

  response.statusCode = upstream.status;
  upstream.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'content-length') return;
    response.setHeader(key, value);
  });
  for (const [key, value] of Object.entries(corsHeaders)) {
    response.setHeader(key, value);
  }

  if (!upstream.body) {
    response.end();
    return;
  }

  const reader = upstream.body.getReader();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        response.write(Buffer.from(value));
      }
    }
  } finally {
    response.end();
  }
}
