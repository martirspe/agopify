import {
  applyTopicChange,
  durableCustomerFacts,
  isRepeatedKnownQuestion,
  knownFactsPromptBlock,
  mergeCustomerMemory,
} from './memory-policy';
import { ExplicitFact, initialSalesState, observeBuyer } from './sales-state';

function fact(
  value: string,
  scope: ExplicitFact['scope'] = 'customer',
  extras: Partial<ExplicitFact> = {},
): ExplicitFact {
  return {
    value,
    source: 'test',
    confidence: 1,
    timestamp: '2026-01-01T00:00:00.000Z',
    scope,
    ...extras,
  };
}

describe('memory-policy', () => {
  it('B: flags repeated questions against confirmed facts including destination', () => {
    const state = initialSalesState();
    state.answeredQuestions = { size: '40', destination: 'Miraflores, Lima, Lima' };
    state.customerFacts = {
      destination: fact('Miraflores, Lima, Lima'),
    };
    expect(isRepeatedKnownQuestion('¿qué talla buscas?', state)).toBe(true);
    expect(
      isRepeatedKnownQuestion('¿para qué distrito es el envío?', state),
    ).toBe(true);
    expect(
      isRepeatedKnownQuestion(
        '¿confirmas que sigue siendo talla 40?',
        state,
      ),
    ).toBe(false);
  });

  it('E: topic change clears product focus and keeps customer/budget facts', () => {
    let state = observeBuyer(
      initialSalesState(),
      'Me llamo Ana. Busco zapatillas talla 40 máximo 200. Vivo en Miraflores, Lima',
      'm1',
    );
    state.selectedProduct = { productId: 'one', variantId: 'one-v40' };
    state.recommendedProductIds = ['one', 'two'];
    state.pendingLines = [
      { productId: 'one', variantId: 'one-v40', quantity: 1 },
    ];
    state = applyTopicChange(state);
    expect(state.selectedProduct).toBeUndefined();
    expect(state.recommendedProductIds).toEqual([]);
    expect(state.pendingLines).toEqual([]);
    expect(state.customerFacts.name?.value).toBe('Ana');
    expect(state.customerFacts.destination?.value).toContain('Miraflores');
    expect(state.requirements.budget?.value).toBe('20000');
    expect(state.requirements.size).toBeUndefined();
    expect(state.answeredQuestions.size).toBeUndefined();
    expect(state.answeredQuestions.name).toBe('Ana');
    expect(state.rejectedProducts.at(-1)?.reason).toBe('topic_change');
  });

  it('F: mergeCustomerMemory restores durable facts into answeredQuestions', () => {
    const state = initialSalesState();
    const memory = {
      name: fact('Ana', 'customer', {
        expiresAt: '2099-01-01T00:00:00.000Z',
      }),
      destination: fact('Miraflores, Lima, Lima', 'customer', {
        expiresAt: '2099-01-01T00:00:00.000Z',
      }),
      price: fact('999', 'customer'),
    };
    const merged = mergeCustomerMemory(state, memory);
    expect(merged.customerFacts.name?.value).toBe('Ana');
    expect(merged.answeredQuestions.name).toBe('Ana');
    expect(merged.answeredQuestions.destination).toContain('Miraflores');
    expect(merged.customerFacts.price).toBeUndefined();
  });

  it('drops expired memory and never persists dynamic commerce keys', () => {
    const state = initialSalesState();
    const merged = mergeCustomerMemory(state, {
      name: fact('Ana', 'customer', {
        expiresAt: '2000-01-01T00:00:00.000Z',
      }),
    });
    expect(merged.customerFacts.name).toBeUndefined();
    expect(
      durableCustomerFacts({
        name: fact('Ana'),
        price: fact('100', 'customer'),
        stock: fact('5', 'customer'),
        size: fact('40', 'conversation'),
      }),
    ).toEqual({ name: fact('Ana') });
  });

  it('conversation-turn facts win over older memory for the same key', () => {
    const state = initialSalesState();
    state.customerFacts = {
      name: fact('Bruno', 'customer', {
        timestamp: '2026-06-01T00:00:00.000Z',
      }),
    };
    const merged = mergeCustomerMemory(state, {
      name: fact('Ana', 'customer', {
        timestamp: '2026-01-01T00:00:00.000Z',
        expiresAt: '2099-01-01T00:00:00.000Z',
      }),
    });
    expect(merged.customerFacts.name?.value).toBe('Bruno');
  });

  it('knownFactsPromptBlock lists confirmed facts for the model', () => {
    const state = observeBuyer(
      initialSalesState(),
      'Me llamo Ana. Talla 40',
      'm1',
    );
    const block = knownFactsPromptBlock(state);
    expect(block).toContain('name: Ana');
    expect(block).toContain('size: 40');
    expect(block).toContain('no vuelvas a preguntarlos');
  });

  it('observeBuyer retains destination on short place answers and topic-change search', () => {
    // Unambiguous place only — bare "Miraflores" has multiple ubigeo hits.
    const withPlace = observeBuyer(initialSalesState(), 'Surco', 'm1');
    expect(withPlace.customerFacts.destination?.value).toContain('Surco');
    expect(withPlace.answeredQuestions.destination).toContain('Surco');

    let browsing = observeBuyer(
      initialSalesState(),
      'Busco zapatillas talla 40',
      'm1',
    );
    browsing.selectedProduct = { productId: 'one' };
    browsing.recommendedProductIds = ['one'];
    browsing = observeBuyer(
      browsing,
      'Ahora busco mochilas para la universidad',
      'm2',
    );
    expect(browsing.selectedProduct).toBeUndefined();
    expect(browsing.requirements.need?.value.toLowerCase()).toContain(
      'mochilas',
    );
    expect(browsing.requirements.size).toBeUndefined();
  });
});
