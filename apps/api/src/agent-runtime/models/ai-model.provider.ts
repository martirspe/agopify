import type {
  AiGenerateRequest,
  AiGenerateResult,
  AiModelCapabilities,
} from './ai-model.types';

export const AI_MODEL_PROVIDERS = Symbol('AI_MODEL_PROVIDERS');

/**
 * Vendor-agnostic chat generation. Business code must not call vendor URLs directly.
 */
export interface AiModelProvider {
  readonly id: string;
  getCapabilities(): AiModelCapabilities;
  generate(request: AiGenerateRequest): Promise<AiGenerateResult | null>;
}
