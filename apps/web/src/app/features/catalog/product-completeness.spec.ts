import { productCompleteness } from './product-completeness';

describe('productCompleteness', () => {
  it('scores an empty product at zero and a filled one at 100', () => {
    expect(
      productCompleteness({ kind: 'PRODUCT', categories: [], photos: 0 }).score,
    ).toBe(0);
    expect(
      productCompleteness({
        kind: 'PRODUCT',
        categories: ['Polos'],
        photos: 2,
        descriptionFull: 'Polo de algodón para uso diario. Incluye bolsa.',
      }).score,
    ).toBe(100);
  });

  it('treats detailed description as the main enrichment signal', () => {
    const { items, score } = productCompleteness({
      kind: 'DIGITAL',
      categories: ['Guías'],
      photos: 1,
      descriptionFull: '',
    });
    expect(score).toBeLessThan(100);
    expect(items.find((item) => item.id === 'description')?.done).toBe(false);
    expect(items.some((item) => item.id === 'license')).toBe(false);
  });
});
