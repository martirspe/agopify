export const AI_RUNTIME_MODES = [
  'inherit',
  'ai_core',
  'shadow',
  'legacy',
] as const;
export type AiRuntimeMode = (typeof AI_RUNTIME_MODES)[number];

export function normalizeAiRuntimeMode(value: unknown): AiRuntimeMode {
  return AI_RUNTIME_MODES.includes(value as AiRuntimeMode)
    ? (value as AiRuntimeMode)
    : 'ai_core';
}

function globalDurable(envMode: string | undefined): boolean {
  const global = envMode ?? 'sales-engine-v2';
  return (
    global === 'sales-engine-v2' ||
    global === 'ai-core' ||
    global === 'shadow'
  );
}

/**
 * Whether inbound messages for this agent use the durable AI Core inbox
 * (`SalesGatewayService`) instead of the synchronous legacy path.
 * Shadow is durable: it processes and records but never sends (see `isShadowAiCore`).
 */
export function usesDurableAiCore(
  envMode: string | undefined,
  agentMode: string | null | undefined,
): boolean {
  const agent = normalizeAiRuntimeMode(agentMode);
  if (agent === 'legacy') return false;
  if (agent === 'ai_core' || agent === 'shadow') return true;
  return globalDurable(envMode);
}

/** Shadow processes the full turn and persists traces but must not message the customer. */
export function isShadowAiCore(
  envMode: string | undefined,
  agentMode: string | null | undefined,
): boolean {
  const agent = normalizeAiRuntimeMode(agentMode);
  if (agent === 'shadow') return true;
  if (agent === 'ai_core' || agent === 'legacy') return false;
  return (envMode ?? '') === 'shadow';
}
