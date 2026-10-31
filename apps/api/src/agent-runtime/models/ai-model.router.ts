import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AI_MODEL_PROVIDERS,
  type AiModelProvider,
} from './ai-model.provider';
import type {
  AiGenerateRequest,
  AiGenerateResult,
  AiModelTask,
} from './ai-model.types';

/** Prefer primary provider; on hard failure try configured fallback once. */
@Injectable()
export class AiModelRouter {
  private readonly logger = new Logger(AiModelRouter.name);
  private readonly byId = new Map<string, AiModelProvider>();

  constructor(
    private readonly config: ConfigService,
    @Optional()
    @Inject(AI_MODEL_PROVIDERS)
    providers: AiModelProvider[] | null,
  ) {
    for (const provider of providers ?? []) {
      this.byId.set(provider.id, provider);
    }
  }

  primaryId(): string {
    return this.config.get<string>('SALES_MODEL_PROVIDER', 'openai') ?? 'openai';
  }

  fallbackId(): string | undefined {
    const value = this.config.get<string>('SALES_MODEL_FALLBACK_PROVIDER');
    return value?.trim() || undefined;
  }

  resolve(task: AiModelTask): AiModelProvider | null {
    void task;
    return this.byId.get(this.primaryId()) ?? null;
  }

  /**
   * Primary once, then at most one capability-equivalent fallback (scenario L).
   * Never retries the same provider; null means controlled degradation upstream.
   */
  async generate(request: AiGenerateRequest): Promise<AiGenerateResult | null> {
    const primary = this.resolve(request.task);
    if (!primary) {
      this.logger.warn(
        JSON.stringify({
          event: 'ai_model_provider_missing',
          provider: this.primaryId(),
          task: request.task,
        }),
      );
      return null;
    }

    try {
      const result = await primary.generate(request);
      if (result) return { ...result, degraded: false };
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          event: 'ai_model_provider_error',
          provider: primary.id,
          task: request.task,
          code: error instanceof Error ? error.name : 'unknown',
        }),
      );
    }

    const fallbackName = this.fallbackId();
    if (!fallbackName || fallbackName === primary.id) return null;
    const fallback = this.byId.get(fallbackName);
    if (!fallback) return null;
    const needTools = Boolean(request.tools?.length);
    const primaryCaps = primary.getCapabilities();
    const fallbackCaps = fallback.getCapabilities();
    // Only fall back between capability-equivalent models for this request.
    if (
      (needTools && !fallbackCaps.tools) ||
      (request.jsonObject &&
        primaryCaps.structuredJson &&
        !fallbackCaps.structuredJson)
    ) {
      this.logger.warn(
        JSON.stringify({
          event: 'ai_model_fallback_skipped_incompatible',
          primary: primary.id,
          fallback: fallback.id,
          task: request.task,
        }),
      );
      return null;
    }

    try {
      const result = await fallback.generate(request);
      return result ? { ...result, degraded: true } : null;
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          event: 'ai_model_fallback_error',
          provider: fallback.id,
          task: request.task,
          code: error instanceof Error ? error.name : 'unknown',
        }),
      );
      return null;
    }
  }
}
