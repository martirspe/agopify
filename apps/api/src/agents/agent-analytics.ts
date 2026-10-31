/** Trace shape persisted on SalesEngineTurn by the sales gateway (ids only). */
export type SalesTurnTraceView = {
  outcome?: string;
  latencyMs?: number;
  validation?: string;
  promptInjection?: boolean;
  lane?: string;
  model?: string;
  agentId?: string | null;
};

export type AgentAnalyticsSummary = {
  windowDays: number;
  sampleSize: number;
  turnsReady: number;
  turnsFailed: number;
  handoffRate: number | null;
  fallbackRate: number | null;
  injectionBlocked: number;
  latencyMs: { p50: number | null; p95: number | null };
  lanes: Record<string, number>;
};

function asTrace(value: unknown): SalesTurnTraceView {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as SalesTurnTraceView;
}

function percentile(sorted: number[], p: number): number | null {
  if (!sorted.length) return null;
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
  );
  return sorted[index];
}

/**
 * Aggregate opaque turn traces for the seller console. Never includes message
 * bodies, phones or checkout URLs — only counts and latency.
 */
export function aggregateSalesTurnAnalytics(
  turns: Array<{ status: string; trace: unknown }>,
  windowDays: number,
): AgentAnalyticsSummary {
  const latencies: number[] = [];
  const lanes: Record<string, number> = {};
  let handoffs = 0;
  let fallbacks = 0;
  let injectionBlocked = 0;
  let turnsReady = 0;
  let turnsFailed = 0;
  let scored = 0;

  for (const turn of turns) {
    if (turn.status === 'READY' || turn.status === 'SENT') turnsReady += 1;
    if (turn.status === 'FAILED') turnsFailed += 1;
    const trace = asTrace(turn.trace);
    if (typeof trace.latencyMs === 'number' && Number.isFinite(trace.latencyMs)) {
      latencies.push(Math.max(0, Math.round(trace.latencyMs)));
    }
    if (trace.outcome === 'handoff') handoffs += 1;
    if (trace.validation === 'fallback') fallbacks += 1;
    if (trace.promptInjection) injectionBlocked += 1;
    if (trace.lane) lanes[trace.lane] = (lanes[trace.lane] ?? 0) + 1;
    if (trace.outcome || trace.validation) scored += 1;
  }

  latencies.sort((a, b) => a - b);
  const denom = Math.max(1, scored || turns.length);

  return {
    windowDays,
    sampleSize: turns.length,
    turnsReady,
    turnsFailed,
    handoffRate: turns.length ? handoffs / denom : null,
    fallbackRate: turns.length ? fallbacks / denom : null,
    injectionBlocked,
    latencyMs: {
      p50: percentile(latencies, 50),
      p95: percentile(latencies, 95),
    },
    lanes,
  };
}
