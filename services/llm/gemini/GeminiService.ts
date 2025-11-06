import { ILLMService, LLMProvider, ChatRequest, StreamChunk } from '../types';
import { prepareChatPayload } from './payloadBuilder';
import { buildProxyAwareGeminiUrl } from '../../../config/geminiProxy';

// 从 chatService.ts 迁移过来的辅助类型
interface Part {
  text?: string;
  inlineData?: { mimeType: string; data: string; };
}

const DEFAULT_API_KEY = (process.env.GEMINI_API_KEY || process.env.API_KEY || 'sk-lixining').trim();
const DEFAULT_API_BASE_URL = (process.env.API_BASE_URL || '/api/gemini').replace(/\/$/, '');

function resolveApiKey(candidate?: string): string {
  const key = candidate?.trim();
  return key && key.length > 0 ? key : DEFAULT_API_KEY;
}

function resolveApiBaseUrl(candidate?: string): string {
  const base = candidate?.trim();
  const selected = base && base.length > 0 ? base : DEFAULT_API_BASE_URL;
  return selected.replace(/\/$/, '');
}

export class GeminiService implements ILLMService {
  readonly provider: LLMProvider = 'gemini';

  /**
   * 获取 Gemini 模型列表
   * 从旧的 modelService.ts 迁移而来
   */
  async getAvailableModels(apiKey: string, apiBaseUrl?: string): Promise<string[]> {
    const envModels = ((import.meta as any).env?.VITE_GEMINI_MODELS || '').split(',').map(m => m.trim()).filter(Boolean);
    const sanitizedApiKey = apiKey.trim().replace(/["']/g, '');

    if (!sanitizedApiKey) {
      return envModels;
    }

    try {
      const trimmedApiBaseUrl = apiBaseUrl?.trim();
      const baseUrl = (trimmedApiBaseUrl || 'https://generativelanguage.googleapis.com').replace(/\/$/, '');
      const url = `${baseUrl}/v1beta/models`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'x-goog-api-key': sanitizedApiKey,
        },
      });
      
      if (!response.ok) {
        let errorDetails = `API call failed with status: ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData?.error?.message) {
            errorDetails += `: ${errorData.error.message}`;
          }
        } catch (e) { /* Response was not JSON */ }
        console.warn(`Failed to get model list for API key ...${sanitizedApiKey.slice(-4)}: ${errorDetails}`);
        return envModels;
      }

      const data = await response.json();
      
      if (!data.models || !Array.isArray(data.models)) {
          console.warn("Invalid API response structure when fetching models.");
          return envModels;
      }

      const apiModels = new Set(data.models
        .filter((m: any) =>
          m.name?.startsWith('models/gemini') &&
          m.supportedGenerationMethods?.includes('generateContent')
        )
        .map((m: any) => m.name.replace('models/', ''))
      );

      // 如果环境变量有值，按环境变量定义的顺序返回（取交集）
      // 如果环境变量为空，返回API的所有模型（保持API原始顺序）
      const availableModels: string[] = envModels.length > 0
        ? envModels.filter(m => apiModels.has(m))
        : Array.from(apiModels) as string[];
      
      return availableModels;
      
    } catch (error) {
      console.warn(`Error fetching models for API key ...${sanitizedApiKey.slice(-4)}:`, error);
      return envModels;
    }
  }

  /**
   * 调用 Gemini API 生成内容流
   * 从旧的 chatService.ts 迁移并适配
   */
  async *generateContentStream(request: ChatRequest): AsyncGenerator<StreamChunk, void, unknown> {
    const { messages, model, persona, config, apiKey, apiBaseUrl, showThoughts } = request;

    // 1. 准备 Payload
    const { formattedHistory, configForApi } = prepareChatPayload(messages, config, persona, showThoughts);
    
    const lastUserMessage = messages[messages.length - 1];
    const newMessage = lastUserMessage?.content || '';

    try {
      const resolvedKey = resolveApiKey(apiKey);
      const resolvedBaseUrl = resolveApiBaseUrl(apiBaseUrl);
      const endpoint = buildProxyAwareGeminiUrl(
        resolvedBaseUrl,
        `/v1beta/models/${model}:streamGenerateContent`,
        { alt: 'sse' }
      );

      const { systemInstruction, thinkingConfig, ...generationConfig } = configForApi;

      const requestBody: any = {
        model,
        contents: formattedHistory,
        generationConfig: {
          temperature: generationConfig.temperature,
          maxOutputTokens: generationConfig.maxOutputTokens,
        },
      };

      if (thinkingConfig) {
        requestBody.generationConfig.thinkingConfig = thinkingConfig;
      }

      if (systemInstruction) {
        requestBody.systemInstruction = {
          role: 'system',
          parts: [{ text: systemInstruction }],
        };
      }

      // Gemini 要求请求中至少包含一个 part，这里确保最后一条消息文本也会作为 part 发送
      if (requestBody.contents.length > 0) {
        const lastMessage = requestBody.contents[requestBody.contents.length - 1];
        const hasParts = Array.isArray(lastMessage?.parts) && lastMessage.parts.length > 0;
        if (!hasParts && newMessage) {
          lastMessage.parts = [{ text: newMessage }];
        }
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': resolvedKey,
          Accept: 'text/event-stream',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok || !response.body) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`Gemini request failed with status ${response.status}: ${errorText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let eventLines: string[] = [];

      const parseEventLines = (lines: string[]): StreamChunk[] => {
        const chunks: StreamChunk[] = [];
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === '[DONE]') {
            continue;
          }

          let parsed: any;
          try {
            parsed = JSON.parse(payload);
          } catch (error) {
            console.warn('Failed to parse Gemini SSE payload:', error, payload);
            continue;
          }

          if (parsed.error) {
            const message = parsed.error.message || 'Unknown Gemini error.';
            chunks.push({ type: 'error', payload: message });
            continue;
          }

          if (!parsed.candidates || parsed.candidates.length === 0) {
            continue;
          }

          const candidate = parsed.candidates[0];
          const content = candidate?.content;
          const parts = content?.parts as Part[] | undefined;
          if (!parts || parts.length === 0) {
            continue;
          }

          for (const part of parts) {
            if (!part.text) continue;
            // @ts-ignore - thought metadata is not typed but can exist on the payload
            const isThought = part.thought || part.thoughtMetadata;
            if (isThought) {
              chunks.push({ type: 'thought', payload: part.text });
            } else {
              chunks.push({ type: 'content', payload: part.text });
            }
          }
        }
        return chunks;
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, newlineIndex).trimEnd();
          buffer = buffer.slice(newlineIndex + 1);

          if (line === '') {
            if (eventLines.length > 0) {
              for (const chunk of parseEventLines(eventLines)) {
                yield chunk;
              }
              eventLines = [];
            }
          } else {
            eventLines.push(line);
          }
        }
      }

      if (eventLines.length > 0) {
        for (const chunk of parseEventLines(eventLines)) {
          yield chunk;
        }
      }

      if (buffer.trim().length > 0) {
        for (const chunk of parseEventLines(buffer.trim().split(/\r?\n/))) {
          yield chunk;
        }
      }

    } catch (error: any) {
      console.error('Error in Gemini stream:', error);
      yield {
        type: 'error',
        payload: error?.message || 'An unknown error occurred in the Gemini service.',
      };
    } finally {
      yield { type: 'end', payload: '' };
    }
  }
}
