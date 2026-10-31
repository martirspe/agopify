import {
  isShadowAiCore,
  normalizeAiRuntimeMode,
  usesDurableAiCore,
} from './ai-runtime-mode';

describe('ai-runtime-mode', () => {
  it('normalizes unknown values to ai_core', () => {
    expect(normalizeAiRuntimeMode('nope')).toBe('ai_core');
    expect(normalizeAiRuntimeMode('ai_core')).toBe('ai_core');
    expect(normalizeAiRuntimeMode('shadow')).toBe('shadow');
  });

  it('supports canary ai_core while global legacy is on', () => {
    expect(usesDurableAiCore('legacy', 'ai_core')).toBe(true);
  });

  it('treats shadow as durable but not live delivery', () => {
    expect(usesDurableAiCore('legacy', 'shadow')).toBe(true);
    expect(isShadowAiCore('sales-engine-v2', 'shadow')).toBe(true);
    expect(isShadowAiCore('shadow', 'inherit')).toBe(true);
    expect(isShadowAiCore('sales-engine-v2', 'ai_core')).toBe(false);
  });

  it('keeps per-agent canary independent of global legacy (no global force)', () => {
    expect(usesDurableAiCore('legacy', 'inherit')).toBe(false);
    expect(usesDurableAiCore('legacy', 'ai_core')).toBe(true);
    expect(isShadowAiCore('legacy', 'ai_core')).toBe(false);
  });

  it('allows one-agent legacy rollback while env stays durable', () => {
    expect(usesDurableAiCore('sales-engine-v2', 'legacy')).toBe(false);
    expect(isShadowAiCore('sales-engine-v2', 'legacy')).toBe(false);
  });
});
