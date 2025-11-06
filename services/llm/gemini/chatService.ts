import { GenerateContentResponse, Type } from "@google/genai";
import { Message, FileAttachment, Settings, Persona } from '../../../types';
import { executeWithKeyRotation, executeStreamWithKeyRotation } from './apiExecutor';
import { prepareChatPayload } from "./payloadBuilder";

// New helper function for the dedicated title generation API
async function generateTitleWithDedicatedAPI(prompt: string, apiKeyFromSettings: string): Promise<{ title: string }> {
  const apiUrl = process.env.TITLE_API_URL || 'https://key.lixining.com/proxy/google/v1beta/models/gemini-flash-lite-latest:streamGenerateContent?alt=sse';
  const apiKey = (process.env.TITLE_API_KEY || apiKeyFromSettings || '').trim();
  const modelName = process.env.TITLE_MODEL_NAME || 'gemini-flash-lite-latest';

  if (!apiKey) {
    throw new Error('Title API key is missing.');
  }

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        model: modelName,
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
      const errorBody = await response.text();
      throw new Error(`API request failed with status ${response.status}: ${errorBody}`);
    }

    const raw = await response.text();
    const lines = raw.split('\n').map(line => line.trim()).filter(line => line.startsWith('data:'));

    let aggregated = '';
    for (const line of lines) {
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        const parsed = JSON.parse(payload);
        const candidates = parsed?.candidates;
        if (Array.isArray(candidates)) {
          for (const candidate of candidates) {
            const parts = candidate?.content?.parts;
            if (Array.isArray(parts)) {
              for (const part of parts) {
                if (typeof part?.text === 'string') {
                  aggregated += part.text;
                }
              }
            }
          }
        }
      } catch (parseError) {
        console.warn('Failed to parse SSE data for title generation:', parseError);
      }
    }

    const title = aggregated.trim().replace(/["']/g, '');
    if (title) {
      return { title };
    }

    const fallbackTitle = prompt.substring(prompt.lastIndexOf('\n') + 1).substring(0, 40) || 'New Chat';
    return { title: fallbackTitle };
  } catch (error) {
    console.error("Dedicated API call failed:", error);
    const fallbackTitle = prompt.substring(prompt.lastIndexOf('\n') + 1).substring(0, 40) || 'New Chat';
    return { title: fallbackTitle };
  }
}

export async function generateChatDetails(apiKeys: string[], prompt: string, model: string, settings: Settings): Promise<{ title: string }> {
  // Check if dedicated title generation API is configured
  if (process.env.TITLE_API_URL && (process.env.TITLE_API_KEY || apiKeys[0])) {
    return generateTitleWithDedicatedAPI(prompt, apiKeys[0]);
  }

  // Fallback to existing Gemini logic
  try {
    const payload = {
      model: model || (process.env.TITLE_MODEL_NAME || 'gemini-flash-lite-latest'),
      contents: prompt,
    };

    const response = await executeWithKeyRotation<GenerateContentResponse>(apiKeys, (ai) =>
      ai.models.generateContent(payload),
      settings.apiBaseUrl
    );

    const title = response.text.trim().replace(/["']/g, ''); // 移除引号
    if (title) {
      return { title };
    }
    
    const fallbackTitle = prompt.substring(prompt.lastIndexOf('\n') + 1).substring(0, 40) || 'New Chat';
    return { title: fallbackTitle };
  } catch (error) {
    console.error("Failed to generate title:", error);
    const fallbackTitle = prompt.substring(prompt.lastIndexOf('\n') + 1).substring(0, 40) || 'New Chat';
    return { title: fallbackTitle };
  }
}
