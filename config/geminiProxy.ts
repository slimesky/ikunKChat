const ABSOLUTE_URL_REGEX = /^https?:\/\//i;

function normalizeRelativeBase(value: string): string {
  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`;
  return withLeadingSlash.replace(/\/$/, '');
}

function filterSearchParams(params?: Record<string, string | undefined>): string {
  if (!params) {
    return '';
  }

  const searchParams = new URLSearchParams();
  for (const [key, rawValue] of Object.entries(params)) {
    if (rawValue === undefined || rawValue === null) continue;
    const value = `${rawValue}`.trim();
    if (value.length === 0) continue;
    searchParams.set(key, value);
  }

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

export function buildProxyAwareGeminiUrl(
  baseUrl: string | undefined,
  path: string,
  searchParams?: Record<string, string | undefined>
): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const query = filterSearchParams(searchParams);
  const rawBase = (baseUrl ?? '').trim();
  const fallbackBase = rawBase.length > 0 ? rawBase : '/api/gemini';
  const isAbsolute = ABSOLUTE_URL_REGEX.test(fallbackBase);
  const normalizedBase = isAbsolute
    ? fallbackBase.replace(/\/$/, '')
    : normalizeRelativeBase(fallbackBase);

  if (!isAbsolute && normalizedBase.startsWith('/api/gemini')) {
    const encodedPath = encodeURIComponent(`${normalizedPath}${query}`);
    const separator = normalizedBase.includes('?') ? '&' : '?';
    return `${normalizedBase}${separator}path=${encodedPath}`;
  }

  return `${normalizedBase}${normalizedPath}${query}`;
}
