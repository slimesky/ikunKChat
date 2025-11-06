import { Settings } from '../../../types';
import { buildProxyAwareGeminiUrl } from '../../../config/geminiProxy';

const DEFAULT_API_BASE_URL = (process.env.API_BASE_URL || '/api/gemini').replace(/\/$/, '');
const DEFAULT_TITLE_MODEL = process.env.TITLE_MODEL_NAME || 'gemini-flash-lite-latest';
const ENV_TITLE_API_URL = process.env.TITLE_API_URL?.trim();
const DEFAULT_TITLE_API_URL =
  ENV_TITLE_API_URL && ENV_TITLE_API_URL.length > 0
    ? ENV_TITLE_API_URL
    : buildProxyAwareGeminiUrl(
        DEFAULT_API_BASE_URL,
        `/v1beta/models/${DEFAULT_TITLE_MODEL}:streamGenerateContent`,
        { alt: 'sse' }
      );
const DEFAULT_API_KEY = (process.env.TITLE_API_KEY || process.env.GEMINI_API_KEY || process.env.API_KEY || 'sk-lixining').trim();

function resolveTitleApiKey(candidate?: string): string {
  const key = candidate?.trim();
  return key && key.length > 0 ? key : DEFAULT_API_KEY;
}

async function requestTitle(prompt: string, apiKey: string, apiUrl: string, model: string): Promise<string> {
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      model,
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 64,
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`Title request failed with status ${response.status}: ${errorBody}`);
  }

  const raw = await response.text();
  const lines = raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('data:'));

  let aggregated = '';
  for (const line of lines) {
    const payload = line.slice(5).trim();
    if (!payload || payload === '[DONE]') continue;

    try {
      const parsed = JSON.parse(payload);
      const candidates = parsed?.candidates;
      if (!Array.isArray(candidates)) continue;

      for (const candidate of candidates) {
        const parts = candidate?.content?.parts;
        if (!Array.isArray(parts)) continue;
        for (const part of parts) {
          if (typeof part?.text === 'string') {
            aggregated += part.text;
          }
        }
      }
    } catch (error) {
      console.warn('Failed to parse title SSE chunk:', error);
    }
  }

  return aggregated.trim();
}

export async function generateChatDetails(
  apiKeys: string[],
  prompt: string,
  _model: string,
  _settings: Settings
): Promise<{ title: string }> {
  const apiKey = resolveTitleApiKey(apiKeys?.[0]);
  const apiUrl = DEFAULT_TITLE_API_URL;
  const model = DEFAULT_TITLE_MODEL;

  try {
    const title = await requestTitle(prompt, apiKey, apiUrl, model);
    if (title) {
      return { title: title.replace(/["']/g, '') };
    }
  } catch (error) {
    console.error('Failed to generate title with dedicated API:', error);
  }

  const fallbackTitle = prompt.substring(prompt.lastIndexOf('\n') + 1).substring(0, 40) || 'New Chat';
  return { title: fallbackTitle };
}
