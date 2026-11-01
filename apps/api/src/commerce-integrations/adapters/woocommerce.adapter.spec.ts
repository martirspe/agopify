import { createHmac } from 'node:crypto';
import { WooCommerceAdapter } from './woocommerce.adapter';

describe('WooCommerceAdapter.verifyWebhook', () => {
  const adapter = new WooCommerceAdapter();

  it('accepts a valid HMAC signature', async () => {
    const body = Buffer.from('{"id":9}');
    const secret = 'whsec';
    const signature = createHmac('sha256', secret).update(body).digest('base64');
    const result = await adapter.verifyWebhook(
      {
        'x-wc-webhook-signature': signature,
        'x-wc-webhook-topic': 'product.updated',
        'x-wc-webhook-delivery-id': 'del-1',
      },
      body,
      { webhookSecret: secret },
    );
    expect(result.valid).toBe(true);
    expect(result.eventId).toBe('del-1');
    expect(result.eventType).toBe('product.updated');
  });

  it('rejects a bad signature', async () => {
    const result = await adapter.verifyWebhook(
      {
        'x-wc-webhook-signature': 'nope',
        'x-wc-webhook-delivery-id': 'del-2',
      },
      Buffer.from('{}'),
      { webhookSecret: 'whsec' },
    );
    expect(result.valid).toBe(false);
  });
});
