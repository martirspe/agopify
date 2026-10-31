import { aggregateSalesTurnAnalytics } from './agent-analytics';

describe('aggregateSalesTurnAnalytics', () => {
  it('computes rates and latency percentiles without needing message bodies', () => {
    const summary = aggregateSalesTurnAnalytics(
      [
        {
          status: 'READY',
          trace: {
            outcome: 'reply',
            latencyMs: 40,
            validation: 'deterministic',
            lane: 'fast',
          },
        },
        {
          status: 'READY',
          trace: {
            outcome: 'handoff',
            latencyMs: 120,
            validation: 'fallback',
            lane: 'complex',
          },
        },
        {
          status: 'FAILED',
          trace: {
            outcome: 'reply',
            latencyMs: 80,
            validation: 'deterministic',
            promptInjection: true,
            lane: 'fast',
          },
        },
      ],
      7,
    );
    expect(summary.sampleSize).toBe(3);
    expect(summary.turnsReady).toBe(2);
    expect(summary.turnsFailed).toBe(1);
    expect(summary.handoffRate).toBeCloseTo(1 / 3);
    expect(summary.fallbackRate).toBeCloseTo(1 / 3);
    expect(summary.injectionBlocked).toBe(1);
    expect(summary.latencyMs.p50).toBe(80);
    expect(summary.latencyMs.p95).toBe(120);
    expect(summary.lanes).toEqual({ fast: 2, complex: 1 });
  });

  it('returns null rates when there are no turns', () => {
    expect(aggregateSalesTurnAnalytics([], 7)).toMatchObject({
      sampleSize: 0,
      handoffRate: null,
      fallbackRate: null,
      latencyMs: { p50: null, p95: null },
    });
  });
});
