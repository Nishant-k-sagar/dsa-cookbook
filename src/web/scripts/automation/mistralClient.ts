import { config, MISTRAL_MAX_TOKENS, MISTRAL_TEMPERATURE } from './config.js';

export function isMistralAvailable(): boolean {
  return config.mistralApiKey !== null && config.mistralApiKey !== '';
}

export interface MistralMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface MistralResponse {
  content: string;
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';
const MAX_RETRIES = 5;
const INITIAL_BACKOFF_MS = 25000;

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function extractJsonText(content: string): string {
  const fenced = content.match(/```json\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    return fenced[1];
  }

  const objectStart = content.indexOf('{');
  const objectEnd = content.lastIndexOf('}');
  if (objectStart !== -1 && objectEnd > objectStart) {
    return content.slice(objectStart, objectEnd + 1);
  }

  const arrayStart = content.indexOf('[');
  const arrayEnd = content.lastIndexOf(']');
  if (arrayStart !== -1 && arrayEnd > arrayStart) {
    return content.slice(arrayStart, arrayEnd + 1);
  }

  throw new Error('No JSON found in response');
}

function parseJsonFromResponse(text: string): unknown {
  const jsonText = extractJsonText(text);
  return JSON.parse(jsonText);
}

export async function callMistral(
  messages: MistralMessage[],
  retries: number = MAX_RETRIES
): Promise<MistralResponse> {
  let lastError: Error | unknown;
  let backoffMs = INITIAL_BACKOFF_MS;
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(MISTRAL_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.mistralApiKey}`
        },
        body: JSON.stringify({
          model: config.mistralModel,
          messages,
          temperature: MISTRAL_TEMPERATURE,
          max_tokens: MISTRAL_MAX_TOKENS
        })
      });

      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : backoffMs;
        console.log(`Rate limited. Waiting ${waitTime}ms before retry...`);
        await sleep(waitTime);
        backoffMs = Math.min(backoffMs * 2, 25000);
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Mistral API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as {
        choices: Array<{ message: { content: string } }>;
        model: string;
        usage?: {
          prompt_tokens: number;
          completion_tokens: number;
          total_tokens: number;
        };
      };
      
      const rawContent = data.choices[0]?.message?.content;
      
      // Ensure content is a string - handle object/array responses
      let content: string;
      if (typeof rawContent === 'string') {
        content = rawContent;
      } else if (typeof rawContent === 'object' && rawContent !== null) {
        // If it's an object or array, stringify it
        content = JSON.stringify(rawContent);
      } else {
        throw new Error('Invalid content type from Mistral: expected string or object');
      }

      if (!content || content.trim() === '') {
        throw new Error('Empty response from Mistral');
      }

      return {
        content,
        model: data.model,
        usage: data.usage
      };

    } catch (error) {
      lastError = error;
      
      if (attempt < retries - 1) {
        console.log(`Mistral call failed (attempt ${attempt + 1}/${retries}): ${error instanceof Error ? error.message : 'Unknown error'}`);
        console.log(`Retrying in ${backoffMs}ms...`);
        await sleep(backoffMs);
        backoffMs = Math.min(backoffMs * 2, 25000);
      }
    }
  }
  
  throw new Error(`Mistral call failed after ${retries} retries: ${lastError instanceof Error ? lastError.message : 'Unknown error'}`);
}

export async function callMistralForJson<T>(
  messages: MistralMessage[],
  retries: number = MAX_RETRIES
): Promise<T> {
  const response = await callMistral(messages, retries);
  
  try {
    const parsed = parseJsonFromResponse(response.content);
    return parsed as T;
  } catch (error) {
    throw new Error(`Failed to parse Mistral response as JSON: ${error instanceof Error ? error.message : 'Unknown error'}. Response: ${response.content.slice(0, 500)}`);
  }
}

export function createMistralClient() {
  return {
    call: callMistral,
    callForJson: callMistralForJson
  };
}
