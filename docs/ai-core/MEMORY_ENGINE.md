# Memory Engine

Implemented behaviour lives in the sales engine. See:

- `docs/AI-SALES-ENGINE.md` → Datos y memoria / Redis
- Code: `sales-memory.service.ts`, `memory-policy.ts`, `sales-state.ts`, `sales-context.ts`
- Models: `Conversation.salesState`, `SalesCustomerMemory`

## Authority

PostgreSQL is authoritative for structured customer memory. Redis holds hot conversation state (`wa:state:{tenantId}:{conversationId}`). Qdrant is not customer memory and never supplies price, stock or payment facts.

## Durable customer facts (Stage 3)

Only explicit, confidence-1 facts with `scope: 'customer'` and keys in `CUSTOMER_DURABLE_KEYS` (`name`, `explicitPreference`, `destination`, `address`) are persisted via `durableCustomerFacts` → `SalesCustomerMemory`.

- **Never** persisted: price, stock, shipping, payment, product/variant ids, inferred demographics.
- TTL: `SALES_CUSTOMER_MEMORY_TTL_DAYS` (default 90). Expired rows are ignored on load even if Redis is stale.
- `customerKey` = SHA-256 of backend-resolved `channelId/thread` (never client-supplied).
- Tenant isolation: composite PK `(tenantId, customerKey)`; loads always filter by `tenantId`.

## Merge policy

`mergeCustomerMemory(state, memory)` on each durable turn (gateway):

1. Drop expired facts.
2. Keep only durable customer-scoped keys.
3. Conversation-turn facts win when newer than memory.
4. Hydrate `answeredQuestions` so the validator / prompt do not re-ask known facts (scenario B/F).

## Topic change (scenario E)

`applyTopicChange` clears product selection, recommendations and pending lines, and drops product-scoped requirements (`need`, size, color) while keeping durable customer facts and non-product requirements (`budget`, `destination`, `address`).

## Prompt + validator

- `knownFactsPromptBlock` injects confirmed facts into the system prompt.
- `isRepeatedKnownQuestion` + `validateSalesResponse` fail drafts that re-ask size/color/budget/name/quantity/destination/address without confirmation language.
