import {
  extractBuyerIntents,
  splitBuyerClauses,
  toSalesStateIntent,
} from './buyer-intents';
import { usesDurableAiCore } from './ai-runtime-mode';

describe('buyer multi-intent extraction', () => {
  it('splits compound commercial questions', () => {
    expect(
      splitBuyerClauses(
        '¿Cuánto cuesta el Urban, tienes talla 42 y cuánto cuesta el envío a Arequipa?',
      ).length,
    ).toBeGreaterThanOrEqual(2);
  });

  it('detects price, size and shipping in one message', () => {
    const analysis = extractBuyerIntents(
      '¿Cuánto cuesta, tienes talla 42 y cuánto cuesta el envío?',
    );
    expect(analysis.intents).toEqual(
      expect.arrayContaining([
        'price_inquiry',
        'product_variant',
        'shipping_inquiry',
      ]),
    );
    expect(analysis.clauseCount).toBeGreaterThanOrEqual(2);
    expect(toSalesStateIntent(analysis.primary)).toBe('product_question');
  });

  it('prioritizes human handoff over catalog search', () => {
    const analysis = extractBuyerIntents(
      'Busco zapatillas pero quiero hablar con una persona',
    );
    expect(analysis.primary).toBe('human_request');
    expect(analysis.intents).toContain('product_search');
  });

  it('detects purchase intent', () => {
    expect(extractBuyerIntents('Lo quiero, ¿dónde pago?').primary).toBe(
      'purchase_intent',
    );
  });

  it('treats “quiero uno” as purchase, not a new product search', () => {
    expect(extractBuyerIntents('Si, quiero uno').primary).toBe(
      'purchase_intent',
    );
    expect(extractBuyerIntents('Quiero un protector solar').primary).toBe(
      'product_search',
    );
  });
});

describe('usesDurableAiCore', () => {
  it('inherits the global durable mode by default', () => {
    expect(usesDurableAiCore('sales-engine-v2', 'inherit')).toBe(true);
    expect(usesDurableAiCore('ai-core', undefined)).toBe(true);
    expect(usesDurableAiCore('legacy', 'inherit')).toBe(false);
  });

  it('allows per-agent override in both directions', () => {
    expect(usesDurableAiCore('legacy', 'ai_core')).toBe(true);
    expect(usesDurableAiCore('legacy', 'shadow')).toBe(true);
    expect(usesDurableAiCore('sales-engine-v2', 'legacy')).toBe(false);
  });
});
