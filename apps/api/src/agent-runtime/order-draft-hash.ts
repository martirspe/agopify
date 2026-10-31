import { createHash } from 'node:crypto';

/** Canonical line for chat-order idempotency (never includes PII). */
export type OrderDraftLine = {
  productId: string;
  variantId: string | null;
  quantity: number;
  unitCents: number;
};

export type OrderDraftInput = {
  tenantId: string;
  conversationId: string;
  currency: string;
  lines: OrderDraftLine[];
  shippingCents: number;
  /** Ubigeo code when delivery was quoted; null for pickup/digital/service/no-ship. */
  districtCode: string | null;
};

/**
 * Stable hash of a confirmed chat cart. Same draft → same hash → one Order row
 * (via Order.checkoutKey). Prices/qty are server-sourced integers only.
 */
export function computeOrderDraftHash(input: OrderDraftInput): string {
  const lines = [...input.lines]
    .map((line) => ({
      productId: line.productId,
      variantId: line.variantId,
      quantity: Math.max(1, Math.min(99, Math.trunc(line.quantity))),
      unitCents: Math.max(0, Math.trunc(line.unitCents)),
    }))
    .sort(
      (a, b) =>
        a.productId.localeCompare(b.productId) ||
        (a.variantId ?? '').localeCompare(b.variantId ?? '') ||
        a.quantity - b.quantity,
    );
  const payload = {
    v: 1,
    tenantId: input.tenantId,
    conversationId: input.conversationId,
    currency: input.currency,
    lines,
    shippingCents: Math.max(0, Math.trunc(input.shippingCents)),
    districtCode: input.districtCode,
  };
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

/** Unique Order.checkoutKey for WhatsApp/Instagram drafts (tenant-scoped prefix). */
export function chatOrderCheckoutKey(
  tenantId: string,
  conversationId: string,
  draftHash: string,
): string {
  return `chat:${tenantId}:${conversationId}:${draftHash}`;
}
