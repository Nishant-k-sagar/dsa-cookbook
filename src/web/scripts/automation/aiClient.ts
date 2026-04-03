import { config } from './config.js';
import { callMistral, callMistralForJson, type MistralMessage, type MistralResponse } from './mistralClient.js';

export type AIMessage = MistralMessage;

export interface AIResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface AIClient {
  call: (messages: AIMessage[], retries?: number) => Promise<AIResponse>;
  callForJson: <T>(messages: AIMessage[], retries?: number) => Promise<T>;
}

function createMistralClient(): AIClient {
  return {
    call: async (msgs: AIMessage[], retries?: number): Promise<AIResponse> => {
      const mistralMsgs = msgs as MistralMessage[];
      const response: MistralResponse = await callMistral(mistralMsgs, retries);
      return {
        content: response.content,
        model: response.model,
        usage: response.usage ? {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens
        } : undefined
      };
    },
    callForJson: async <T,>(msgs: AIMessage[], retries?: number): Promise<T> => {
      const mistralMsgs = msgs as MistralMessage[];
      return callMistralForJson<T>(mistralMsgs, retries);
    }
  };
}

function getActiveProvider(): AIClient {
  console.log('[AI Client] Using Mistral API');
  if (!config.mistralApiKey) {
    throw new Error('MISTRAL_API_KEY is not set');
  }
  return createMistralClient();
}

let cachedClient: AIClient | null = null;

export function createAIClient(): AIClient {
  if (!cachedClient) {
    cachedClient = getActiveProvider();
  }
  return cachedClient;
}

export function isAIAvailable(): boolean {
  return config.mistralApiKey !== null && config.mistralApiKey !== '';
}

export function getCurrentProviderName(): string {
  return 'Mistral';
}
