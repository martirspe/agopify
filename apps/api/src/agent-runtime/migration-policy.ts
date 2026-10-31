import { normalizeAiRuntimeMode, type AiRuntimeMode } from './ai-runtime-mode';

/**
 * Audit helper for rare ops/API mode changes. Progressive console rollout was
 * retired: new agents default to `ai_core` and the merchant UI no longer switches motors.
 */
export function describeModeChange(
  from: string | null | undefined,
  to: string | null | undefined,
): { from: AiRuntimeMode; to: AiRuntimeMode; risk: 'low' | 'medium' | 'high' } {
  const previous = normalizeAiRuntimeMode(from);
  const next = normalizeAiRuntimeMode(to);
  let risk: 'low' | 'medium' | 'high' = 'low';
  if (next === 'ai_core' && previous !== 'ai_core') risk = 'medium';
  if (next === 'legacy' && previous !== 'legacy') risk = 'medium';
  if (previous === 'shadow' && next === 'ai_core') risk = 'medium';
  if (next === 'shadow') risk = 'low';
  return { from: previous, to: next, risk };
}
