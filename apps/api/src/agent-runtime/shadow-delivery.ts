/**
 * Defense-in-depth for SHADOW delivery metadata. Shadow must never call Meta and
 * must never persist live payment artifacts even if a tool bug returned them.
 */

const SHADOW_CHECKOUT_PREFIX = 'https://playground.local/';
const SHADOW_ORDER_PREFIX = 'pg_order_';

export type ShadowDeliveryArtifacts = {
  orderId?: string | null;
  checkoutUrl?: string | null;
};

export type ShadowSanitizeResult = {
  orderId: string | null;
  checkoutUrl: string | null;
  blocked: Array<'orderId' | 'checkoutUrl'>;
};

export function isShadowSafeCheckoutUrl(url: string | null | undefined): boolean {
  if (!url) return true;
  return url.startsWith(SHADOW_CHECKOUT_PREFIX);
}

export function isShadowSafeOrderId(orderId: string | null | undefined): boolean {
  if (!orderId) return true;
  return orderId.startsWith(SHADOW_ORDER_PREFIX);
}

/** Strip live commerce artifacts before writing a shadow-recorded message. */
export function sanitizeShadowArtifacts(
  input: ShadowDeliveryArtifacts,
): ShadowSanitizeResult {
  const blocked: Array<'orderId' | 'checkoutUrl'> = [];
  let orderId = input.orderId ?? null;
  let checkoutUrl = input.checkoutUrl ?? null;

  if (!isShadowSafeOrderId(orderId)) {
    blocked.push('orderId');
    orderId = null;
  }
  if (!isShadowSafeCheckoutUrl(checkoutUrl)) {
    blocked.push('checkoutUrl');
    checkoutUrl = null;
  }

  return { orderId, checkoutUrl, blocked };
}
