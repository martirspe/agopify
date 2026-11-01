import { handleForExternalProduct, normalizeExternalProduct } from './product-normalizer';

describe('product-normalizer', () => {
  it('normalizes money to integer cents and keeps source identity', () => {
    const normalized = normalizeExternalProduct(
      {
        id: '42',
        title: ' Camisa ',
        priceCents: 1999.4,
        status: 'active',
        inventory: [{ isAvailable: true, availableQuantity: 3 }],
      },
      { tenantId: 't1', integrationId: 'i1', platform: 'woocommerce' },
    );
    expect(normalized.priceCents).toBe(1999);
    expect(normalized.title).toBe('Camisa');
    expect(normalized.source.externalProductId).toBe('42');
    expect(normalized.isAvailable).toBe(true);
  });

  it('builds a stable external handle', () => {
    expect(handleForExternalProduct('magento', 'sku-1', 'Polo Azul')).toContain(
      'magento-sku-1',
    );
  });
});
