import {
  multiQuestionPromptGuide,
  selectProcessingLane,
} from './processing-lanes';
import {
  factualLinesForIntents,
  missingSubquestionCoverage,
} from './multi-question';
import { resolveSalesReference, initialSalesState } from './sales-state';

const product = (id: string, name: string) => ({
  id,
  handle: id,
  name,
  descriptionShort: null,
  basePriceCents: 15000,
  priceLabel: 'S/ 150.00',
  stockLabel: '2 en stock',
  stockUnlimited: false,
  stockQty: 2,
  currency: 'PEN',
  isAvailable: true,
  categories: [],
  isService: false,
  productUrl: null,
  imageUrl: null,
  variants: [
    {
      id: `${id}-v`,
      label: 'Negro / 40',
      priceCents: 15000,
      priceLabel: 'S/ 150.00',
      stockLabel: '2 en stock',
      isAvailable: true,
    },
  ],
});

describe('processing lanes', () => {
  it('routes greetings to the fast lane', () => {
    expect(
      selectProcessingLane({
        conversationalIntent: 'greeting',
        intents: [],
        hasResolvedReference: false,
        pendingDeliveryQuestion: false,
        buying: false,
        humanOrComplaint: false,
      }),
    ).toBe('fast');
  });

  it('routes multi commercial intents to complex', () => {
    expect(
      selectProcessingLane({
        conversationalIntent: null,
        intents: ['price_inquiry', 'product_variant', 'shipping_inquiry'],
        hasResolvedReference: false,
        pendingDeliveryQuestion: false,
        buying: false,
        humanOrComplaint: false,
      }),
    ).toBe('complex');
  });

  it('builds a multi-question prompt checklist', () => {
    expect(
      multiQuestionPromptGuide([
        'price_inquiry',
        'shipping_inquiry',
      ]),
    ).toMatch(/TODAS/);
  });
});

describe('multi-question factual coverage', () => {
  it('answers price, size and shipping without inventing a rate', () => {
    const lines = factualLinesForIntents({
      intents: ['price_inquiry', 'product_variant', 'shipping_inquiry'],
      product: product('one', 'Zapatilla negra Uno'),
      requestedSize: '40',
    });
    expect(lines.join(' ')).toMatch(/S\/ 150/);
    expect(lines.join(' ')).toMatch(/talla 40/i);
    expect(lines.join(' ')).toMatch(/distrito/i);
    expect(lines.join(' ')).not.toMatch(/\d+\s*soles.*envio/i);
  });

  it('detects missing sub-questions', () => {
    expect(
      missingSubquestionCoverage('Solo te digo hola', [
        'price_inquiry',
        'shipping_inquiry',
      ]),
    ).toEqual(['price_inquiry', 'shipping_inquiry']);
  });
});

describe('ordinal + color reference', () => {
  it('resolves el segundo even when color is also mentioned', () => {
    const state = initialSalesState();
    state.recommendedProductIds = ['one', 'two'];
    const products = [
      product('one', 'Zapatilla negra Uno'),
      product('two', 'Zapatilla negra Dos'),
    ];
    expect(
      resolveSalesReference('¿Y el segundo en negro?', state, products)?.id,
    ).toBe('two');
  });

  it('resolves el último to the last presentation slot without shifting', () => {
    const state = initialSalesState();
    state.recommendedProductIds = ['one', 'two', 'three'];
    const products = [
      product('one', 'Protector Uno'),
      product('two', 'Protector Dos'),
      product('three', 'Protector Tres'),
    ];
    expect(
      resolveSalesReference('Me interesa el último', state, products)?.id,
    ).toBe('three');
    expect(
      resolveSalesReference('el último', state, [products[0], products[1]]),
    ).toBeNull();
  });

  it('resolves “el que viene sólo” to the non-bundle recommendation', () => {
    const state = initialSalesState();
    state.recommendedProductIds = ['deo', 'set'];
    const products = [
      product('deo', 'Temptation Desodorante Perfumado Roll on Hombre'),
      product('set', 'Set Temptation Hombre'),
    ];
    expect(
      resolveSalesReference('El que viene sólo', state, products)?.id,
    ).toBe('deo');
    expect(resolveSalesReference('el set', state, products)?.id).toBe('set');
  });
});
