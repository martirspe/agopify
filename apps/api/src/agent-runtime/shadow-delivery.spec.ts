import {
  isShadowSafeCheckoutUrl,
  isShadowSafeOrderId,
  sanitizeShadowArtifacts,
} from './shadow-delivery';

describe('shadow-delivery', () => {
  it('accepts playground dry-run artifacts', () => {
    expect(isShadowSafeOrderId('pg_order_abc123')).toBe(true);
    expect(
      isShadowSafeCheckoutUrl('https://playground.local/checkout/pg_order_abc'),
    ).toBe(true);
    expect(
      sanitizeShadowArtifacts({
        orderId: 'pg_order_abc',
        checkoutUrl: 'https://playground.local/checkout/x',
      }).blocked,
    ).toEqual([]);
  });

  it('blocks live order ids and payment URLs', () => {
    const result = sanitizeShadowArtifacts({
      orderId: 'clxyz123liveorder',
      checkoutUrl: 'https://www.mercadopago.com.pe/checkout/v1/redirect?pref_id=1',
    });
    expect(result.orderId).toBeNull();
    expect(result.checkoutUrl).toBeNull();
    expect(result.blocked).toEqual(['orderId', 'checkoutUrl']);
    expect(isShadowSafeOrderId('clxyz123liveorder')).toBe(false);
    expect(
      isShadowSafeCheckoutUrl('https://pay.mercadopago.com/checkout/1'),
    ).toBe(false);
  });
});
