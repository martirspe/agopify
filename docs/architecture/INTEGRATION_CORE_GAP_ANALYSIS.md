# Integration Core — Gap Analysis

**Proyecto:** Agopify  
**Fuente de verdad arquitectónica:** `INTEGRATION_CORE_ARCHITECTURE.md`  
**Fecha:** 2026-10-31  
**Estado:** Phase B complete — drives Phase C/D implementation  
**Prioridad de adaptadores:** Magento 2 / Adobe Commerce y WooCommerce primero; otras plataformas mapeadas en registry.

---

## 1. Current implementation

### 1.1 Repository shape

| Surface | Stack | Relevant domains |
| --- | --- | --- |
| `apps/api` | NestJS 11 + Fastify + Prisma 6 + PostgreSQL | catalog, channels, payments, integrations (plan), agent-runtime, conversion, live |
| `apps/web` | Angular 22 console | `features/integrations` (plan + waitlist cards), `features/catalog` |
| `apps/store` | Angular 22 SSR store | reads unified catalog via storefront API |
| Packages | ui, design-tokens, contracts, themes | no commerce-connector types yet |

### 1.2 What “integrations” means today

`apps/api/src/integrations/` + `TenantIntegration` manage **plan feature switches** (`store`, `custom_domain`, `instagram`, `tracking`, `team`, `tiktok_live`). Controllers, DTOs and console `IntegrationsApiService` are coupled to that contract.

There is **no** Magento / WooCommerce / additional-platform connector, OAuth app, catalog sync job or external product identity table.

Console e-commerce cards for mapped platforms are **waitlist** placeholders in `integrations.page.ts`.

### 1.3 Unified catalog (exists — reuse)

- `Product`, `ProductVariant`, `ProductMedia`, `ProductComponent`, `CatalogCategory`
- Money: integer cents (`basePriceCents`, `priceCents`, …)
- Tenant isolation: `@@unique([tenantId, handle])`, queries scoped by `tenantId`
- Manual create/update: `catalog.service.ts`
- Package import/export: `catalog-import.service.ts` (ZIP/CSV, not platform APIs)
- Agents read via `sales-agent-tools.service.ts` → `catalog-search` + Prisma; Qdrant for semantics (`sales-search.service.ts`)
- **No** `sourcePlatform` / `externalProductId` on `Product` today

### 1.4 Credentials & security patterns (reuse)

- AES-256-GCM: `payments/credentials-cipher.ts`
- Channel seal/open: `ChannelCredentialsService` (`CHANNEL_CREDENTIALS_KEY`)
- Merchant MP: `MerchantAccountsService` (`PAYMENT_CREDENTIALS_KEY`)
- Webhook dedupe: `WebhookEvent` (`key` unique) — Meta / Mercado Pago synchronous today
- SSRF: limited helpers for public API URLs (WhatsApp); **no** general allowlist for merchant-supplied store base URLs

### 1.5 Queues & workers (reuse)

- Redis optional via env; BullMQ in `conversion/` (cart recovery, recommendation vectors)
- Sales engine: PostgreSQL inbox/outbox + Redis leases (not BullMQ)
- Context-map discrepancy: webhook queues/DLQ still marked PLANNED for Meta/MP

### 1.6 Auth / tenancy

- Global JWT; controllers pass `user.tenantId`
- Managers: `assertManager` (`OWNER` / `ADMIN`)
- Platform staff separate from business tokens

### 1.7 TikTok LIVE (adjacent, do not conflate)

`live/` + `LiveIntegration` is a **capability adapter for LIVE sales**, gated by plan integration `tiktok_live`. Pattern useful (OAuth-ish connect, encrypted secrets, webhooks) but domain-specific — do not fold into Commerce Integration Core as a product catalog source.

---

## 2. Target vs current — component matrix

| Architecture component | Status | Gap |
| --- | --- | --- |
| Integration Core module (commerce) | Missing | New Nest module; must not overwrite plan `integrations` |
| Platform Adapter Registry | Missing | In-memory registry + capability declarations |
| Adapter contract | Missing | Typed interface + capability gating |
| Authentication Manager | Partial | Reuse cipher; new key + SSRF for store URLs |
| CommerceIntegration persistence | Missing | New Prisma models |
| External resource mapping | Missing | `CommerceIntegrationResource` |
| Product Normalizer | Missing | Canonical → existing `Product` upsert |
| Sync Engine | Missing | Initial / incremental / event / reconcile |
| Job Orchestrator | Partial | BullMQ pattern exists; new queue(s) |
| Webhook Gateway (commerce) | Missing | Provider-specific verify + persist + enqueue |
| Integration Monitor | Missing | Derived from sync executions + status fields |
| AI Commerce Layer | Partial | Agents already use central catalog; need source mapping + freshness later |
| Console commerce connectors UX | Waitlist only | Real connect/sync UI for Magento + Woo |
| Mapped platform adapters | Missing | Registry stubs + capability map only (per product priority) |

---

## 3. Reusable components

1. **Catalog domain** — persist synchronized products as normal `Product` rows; keep manual products untouched.
2. **`credentials-cipher`** — authenticated encryption for tokens/keys.
3. **BullMQ + Redis** — async sync jobs (mirror `conversion-infrastructure`).
4. **`WebhookEvent` pattern** — unique key for idempotency (commerce events may use dedicated table for richer audit).
5. **`assertManager` + JWT tenantId** — connection admin API.
6. **`sales-agent-tools` / `catalog-search`** — no second product API for agents once rows exist.
7. **Catalog import upsert heuristics** — inspiration for create/update by handle, not a drop-in for platform IDs.
8. **Live/TikTok connect UX patterns** — reference for connection wizards (do not share tables).

---

## 4. Proposed changes (safe incremental)

### 4.1 Module & API naming

| Concern | Choice |
| --- | --- |
| Nest module path | `apps/api/src/commerce-integrations/` |
| HTTP prefix | `/api/v1/commerce-integrations` |
| Webhooks | `/api/v1/webhooks/commerce/:platform/:integrationId` |
| Prisma models | `CommerceIntegration`, `CommerceIntegrationResource`, `CommerceSyncExecution`, `CommerceWebhookEvent` |
| Env | `INTEGRATION_CREDENTIALS_KEY` (32-byte; same format as payment/channel keys) |

Plan `integrations` unchanged.

### 4.2 Database impact (additive)

- New enums: platform, connection status, sync type/status, resource type, webhook processing status
- New tables listed above; FK to `Tenant`; optional FK from resource → `Product` / `ProductVariant` via `internalId` string + type
- **No** destructive change to `Product`; optional later columns (`sourceIntegrationId`) deferred — mapping table is enough for Phase 1–2
- New migration after `0001_init` (e.g. `0002_commerce_integrations`)

### 4.3 API impact

New authenticated manager endpoints for platforms list, connect, test, disconnect, sync trigger, sync history. Public webhook routes with `@Public()` + signature verification.

Swagger tags: `commerce-integrations`.

### 4.4 Frontend impact

- Extend console integrations marketplace: Magento + WooCommerce cards call real API; mapped platforms remain waitlist with honest copy
- Prefer dedicated routes under `/app/commerce-integrations` or deepen existing e-commerce section without breaking plan toggles
- No fake sync metrics

### 4.5 Security risks & mitigations

| Risk | Mitigation |
| --- | --- |
| SSRF via Magento/Woo base URL | URL allowlist helper: HTTPS, resolve DNS, block private/link-local/metadata, limit redirects |
| Credential leak | Encrypted at rest; redact in logs; never return secrets in DTO views |
| Cross-tenant IDOR | All queries `{ id, tenantId }`; webhook path binds integration id + verified signature |
| Replay webhooks | Persist `externalEventId` unique per integration; timestamp window when provider supports it |
| Breaking plan integrations | Separate module/routes/models |

### 4.6 Migration risks

- Only additive migration → low risk to existing data
- Sync writing products must not collide handles: derive handle from external id + slug rules; unique per tenant
- Soft-delete / unpublish policy for removed external products (configurable; default unpublish, do not hard-delete orders history)

### 4.7 AI / agent impact

- Phase 1–2: zero agent code change if products land in `Product` with `isAvailable` / prices correct
- Phase later: freshness policy + optional on-demand refresh; never invent stock in LLM

---

## 5. Recommended implementation sequence

Aligned with user priority (Magento + Woo first):

1. **Foundation** — contracts, registry, Prisma, credentials, SSRF helper, connection CRUD API, unit tests  
2. **Normalize + resource map + sync orchestrator skeleton** — enqueue BullMQ jobs; persist executions  
3. **Magento adapter** — REST validate + paginated product fetch + normalize (polling-first)  
4. **WooCommerce adapter** — REST + webhook signature verify + product fetch + normalize  
5. **Catalog writer** — upsert into existing `Product` via mapping table; preserve manual products  
6. **Console** — connect/test/sync for Magento + Woo; mapped platforms remain registry-only cards  
7. **AI freshness / mapped-platform full adapters** — later milestones  

---

## 6. Explicit non-goals for first milestone

- Rewriting catalog, agent-runtime, or plan integrations
- Parallel product tables per platform
- Full adapters for remaining mapped platforms
- Replacing Meta/MP webhook pipeline
- New message broker

---

## 7. Definition of done (this pass)

| Item | Target for current implementation wave |
| --- | --- |
| Architecture doc in repo | `INTEGRATION_CORE_ARCHITECTURE.md` |
| This gap analysis | Done |
| Registry + adapter contract | Implement |
| Magento + Woo adapters (connect/validate + fetch/normalize paths) | Implement |
| Mapped platforms | Registry map + stub / unsupported capabilities |
| Sync job enqueue + execution records | Implement skeleton + initial sync path |
| Webhook gateway shell (Woo) | Implement verify + persist + enqueue |
| Console wiring | Magento/Woo connectable; others mapped |
| Regression | Existing catalog/agents/plan integrations untouched; builds + focused tests |

---

## 8. Conflicts resolved

| Conflict | Resolution |
| --- | --- |
| Arch doc `/integrations` vs plan module | Use `/commerce-integrations` |
| Arch roadmap vs product ask | Magento + Woo first; others mapped |
| Money as float in sample NormalizedProduct | Integer cents only |
| Sync inside HTTP | Always async via queue; HTTP starts job |
| New broker | Reuse Redis/BullMQ |

---

**Next:** Phase C/D — implement foundation + Magento/Woo reference adapters per this analysis.
