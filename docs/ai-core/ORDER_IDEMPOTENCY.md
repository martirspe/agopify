# Chat order idempotency (Stage 4 / scenario I)

L2 commercial commits stay in backend services. The model never creates orders.

## Draft identity

`computeOrderDraftHash` hashes:

- `tenantId`, `conversationId`, `currency`
- sorted lines: `productId`, `variantId`, `quantity`, `unitCents`
- `shippingCents`, `districtCode`

No names, phones or free-text addresses enter the hash.

## Persistence

| Field | Value |
| --- | --- |
| `Order.checkoutKey` | `chat:{tenantId}:{conversationId}:{draftHash}` |
| `Order.requestHash` | same as `draftHash` |
| `SalesState.orderDraftHash` | draft hash of the last successful commit |

Retries and concurrent turns with the same draft load the existing order (and its payment link) instead of inserting a second row. Unique races (`P2002`) reload the winner.

## Modes

- `production`: real Order + Payment with idempotency when `conversationId` is present.
- `shadow` / `playground`: dry-run ids derived from the hash; no DB write.
