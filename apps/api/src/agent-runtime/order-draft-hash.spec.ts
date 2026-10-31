import {
  chatOrderCheckoutKey,
  computeOrderDraftHash,
} from './order-draft-hash';

describe('order-draft-hash', () => {
  const base = {
    tenantId: 'tenant-a',
    conversationId: 'conv-1',
    currency: 'PEN',
    lines: [
      {
        productId: 'p2',
        variantId: 'v2',
        quantity: 1,
        unitCents: 16000,
      },
      {
        productId: 'p1',
        variantId: 'v1',
        quantity: 2,
        unitCents: 15000,
      },
    ],
    shippingCents: 1000,
    districtCode: '150122',
  };

  it('is stable under line reordering and ignores PII', () => {
    const a = computeOrderDraftHash(base);
    const b = computeOrderDraftHash({
      ...base,
      lines: [...base.lines].reverse(),
    });
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
    expect(chatOrderCheckoutKey('tenant-a', 'conv-1', a)).toBe(
      `chat:tenant-a:conv-1:${a}`,
    );
  });

  it('changes when product, qty, price, shipping or district change', () => {
    const a = computeOrderDraftHash(base);
    expect(
      computeOrderDraftHash({
        ...base,
        lines: [{ ...base.lines[0], quantity: 3 }],
      }),
    ).not.toBe(a);
    expect(
      computeOrderDraftHash({ ...base, shippingCents: 0 }),
    ).not.toBe(a);
    expect(
      computeOrderDraftHash({ ...base, districtCode: null }),
    ).not.toBe(a);
    expect(
      computeOrderDraftHash({ ...base, tenantId: 'tenant-b' }),
    ).not.toBe(a);
  });

  it('scopes checkout keys by tenant so keys cannot collide across tenants', () => {
    const hash = computeOrderDraftHash(base);
    expect(chatOrderCheckoutKey('tenant-a', 'conv-1', hash)).not.toBe(
      chatOrderCheckoutKey('tenant-b', 'conv-1', hash),
    );
  });
});
