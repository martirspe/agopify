import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AiModelProvider } from './ai-model.provider';
import type {
  AiGenerateRequest,
  AiGenerateResult,
  AiModelCapabilities,
} from './ai-model.types';

@Injectable()
export class OpenAiChatProvider implements AiModelProvider {
  readonly id = 'openai';

  constructor(private readonly config: ConfigService) {}

  getCapabilities(): AiModelCapabilities {
    return {
      provider: this.id,
      chat: true,
      structuredJson: true,
      tools: true,
      streaming: false,
    };
  }

  async generate(request: AiGenerateRequest): Promise<AiGenerateResult | null> {
    const apiKey =
      request.apiKey ?? this.config.get<string>('OPENAI_API_KEY') ?? undefined;
    if (!apiKey) return null;

    const model =
      request.model ??
      this.config.get<string>('OPENAI_MODEL', 'gpt-4o-mini') ??
      'gpt-4o-mini';
    const timeoutMs = request.timeoutMs ?? 12000;

    const body: Record<string, unknown> = {
      model,
      temperature: request.temperature ?? 0.4,
      max_tokens: request.maxTokens ?? 800,
      messages: request.messages,
    };
    if (request.jsonObject) {
      body.response_format = { type: 'json_object' };
    }
    if (request.tools?.length) {
      body.tools = request.tools;
      body.tool_choice = request.toolChoice ?? 'auto';
      body.parallel_tool_calls = request.parallelToolCalls ?? false;
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) return null;

    const payload = (await response.json()) as {
      choices?: Array<{ message?: AiGenerateResult['message'] }>;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        prompt_tokens_details?: { cached_tokens?: number };
      };
    };
    const message = payload.choices?.[0]?.message;
    if (!message) return null;

    return {
      message,
      provider: this.id,
      model,
      usage: {
        promptTokens: payload.usage?.prompt_tokens,
        completionTokens: payload.usage?.completion_tokens,
        cachedPromptTokens: payload.usage?.prompt_tokens_details?.cached_tokens,
      },
    };
  }
}
