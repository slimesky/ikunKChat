import { Persona, Settings } from '../../types';

const DEFAULT_API_KEY = (process.env.GEMINI_API_KEY || process.env.API_KEY || 'sk-lixining').trim();
const DEFAULT_API_BASE_URL = (process.env.API_BASE_URL || '/api/gemini').replace(/\/$/, '');

function resolveApiKey(candidate?: string): string {
  const key = candidate?.trim();
  return key && key.length > 0 ? key : DEFAULT_API_KEY;
}

function resolveBaseUrl(candidate?: string): string {
  const base = candidate?.trim();
  const selected = base && base.length > 0 ? base : DEFAULT_API_BASE_URL;
  return selected.replace(/\/$/, '');
}

export async function generatePersonaUpdate(
  apiKeys: string[],
  model: string,
  currentPersona: Persona,
  userInstruction: string,
  settings: Settings
): Promise<{ personaUpdate: Partial<Persona>; explanation: string }> {
  const apiKey = resolveApiKey(apiKeys?.[0]);
  const baseUrl = resolveBaseUrl(settings.apiBaseUrl);
  const endpoint = `${baseUrl}/v1beta/models/${model}:generateContent`;

  const systemPrompt = `你是一个AI助手，帮助用户配置聊天机器人的角色。用户将提供他们当前的角色配置（JSON对象）和如何修改的指令。\n你的任务是生成一个JSON对象，表示角色的*更新*字段，以及关于你所做的更改的简短友好的解释。\n\n当前角色:\n${JSON.stringify(currentPersona, null, 2)}\n\n用户指令:\n"${userInstruction}"\n\n请仅使用包含两个键的JSON对象响应: "personaUpdate"（包含仅更改的字段）和"explanation"（描述你操作的简短对话式字符串）。例如，如果用户说"让它成为海盗"，你可能会更改姓名、简介和系统提示。`;

  try {
    const response = await fetch(endpoint, {
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
            parts: [{ text: systemPrompt }],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.6,
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(`Persona update request failed with status ${response.status}: ${errorBody}`);
    }

    const data = await response.json();
    const candidate = data?.candidates?.[0];
    const parts = candidate?.content?.parts;
    if (!Array.isArray(parts) || parts.length === 0) {
      throw new Error('Empty response from Gemini persona endpoint.');
    }

    const text = parts
      .map((part: any) => (typeof part?.text === 'string' ? part.text : ''))
      .join('')
      .trim();

    if (!text) {
      throw new Error('Gemini persona endpoint returned no usable text.');
    }

    return JSON.parse(text);
  } catch (error) {
    console.error('Error generating persona update:', error);
    throw new Error('Failed to update persona with AI. Please try again.');
  }
}
