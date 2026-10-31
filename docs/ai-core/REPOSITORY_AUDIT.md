# Phase 0 — Repository audit (VendedorIA AI Core)

**Date:** 2026-10-30  
**Authority:** Executable code > this report.  
**Stack verified:** npm workspaces; `apps/api` NestJS 11 + Fastify + Prisma 6; `apps/web` / `apps/store` Angular 22; PostgreSQL; Redis; optional Qdrant.

## A. Repository architecture

| Surface | Path | Role |
| --- | --- | --- |
| API | `apps/api` | Auth, tenants, agents, agent-runtime, channels, conversations, catalog, orders, payments, billing, storefront, knowledge, conversion, live, platform |
| Console + marketing | `apps/web` | Seller config, inbox, channels, store admin |
| Tenant store | `apps/store` | Public SSR storefront by host |
| Packages | `packages/{ui,design-tokens,contracts,themes}` | Shared UI, tokens, store contracts, themes |
| Infra | `docker-compose*.yml`, `infra/terraform/` | Dev/prod Docker, AWS IaC |
| Sales ops docs | `docs/AI-SALES-ENGINE.md` | Durable engine behaviour |

Backend modules live under `apps/api/src/<domain>/` (controller → service → Prisma). No separate domain/repository layer.

## B. Existing AI implementation

**Already production-shaped as “AI Sales Engine v2”** — this **is** the AI Core substrate. Do not fork a parallel brain.

| Concern | Implementation |
| --- | --- |
| Agent entity | Prisma `SalesAgent` (personality, techniques, guardrails, prompt mode) |
| Orchestration | `SalesAgentRuntimeService.generateReply` |
| Durable channel path | `SalesGatewayService` when `SALES_ENGINE_MODE=sales-engine-v2` |
| Legacy path | Sync generate+send in `ConversationsService` when `legacy` |
| Playground | `agents/playground.service.ts` → same runtime, isolated state, no live orders |
| LLM | OpenAI chat completions via `AiModelProvider` / OpenAI adapter (`agent-runtime/models/`); previously inline `fetch` |
| Embeddings | OpenAI in `sales-search.service.ts` |
| Tools (model) | 8 read tools in `SalesToolRegistry` |
| Commerce writes | Backend-owned: order + payment link + escalate |
| State | Versioned `SalesState` on conversation/playground |
| Customer memory | `SalesCustomerMemory` + Redis hot copy |
| Validation | `validateSalesResponse` |
| Evaluation | Offline dataset + `eval:sales` |

**Gaps vs full AI Core spec (prioritized):** multi-provider adapters beyond OpenAI; richer probabilistic understanding; inbound media; annotated live-model eval; optional per-agent runtime override in UI; Messenger channel (not in product — only WhatsApp / Instagram / TikTok LIVE).

## C. Channel integrations

| Channel | Inbound | Outbound | Notes |
| --- | --- | --- | --- |
| WhatsApp | `POST /webhooks/meta/whatsapp` (+ manual `.../manual/:channelId`) | `ChannelMessengerService` / Meta client | Text ingest; images + payment CTA outbound |
| Instagram | `POST /webhooks/meta/instagram` | Instagram DM send | Text only; skip echoes |
| Facebook Messenger | — | — | **Not implemented** (`ChannelType` has no Messenger) |
| TikTok LIVE | Separate `live/` module | — | Excluded from sales gateway path |

Idempotency: `Message.inboundKey` unique + Redis `wa:processed:*`. Signature verification in `ChannelsService`.

## D. Business capabilities (reuse as tools / actions)

Catalog search + hydrate, variants, stock, price, shipping (`planDelivery` / storefront rules), FAQ/policy (`KnowledgeService`), order create/status, payment checkout (flow B), handoff email, media for WhatsApp images, plan AI reply limits (`PlanLimitsService`).

No parallel catalog or inventory service for the agent — Prisma + `SalesAgentToolsService`.

## E. Infrastructure usage

| Tech | Infra present | Agent usage |
| --- | --- | --- |
| PostgreSQL | Always | Authority for state, inbox, memory, catalog, turns |
| Redis | Always in compose | Dedup, buffer, lock, hot state, embedding cache; BullMQ only for conversion recovery/affinity |
| Qdrant | Optional / profile | Sales semantic IDs (`sales_semantic_*`) + store affinity (separate collection) |
| Object storage | S3/local | Product media; not chat memory |
| Queues | BullMQ | Not used for sales turns (PG poll + setInterval) |

## F. Baseline

See `BASELINE.md` (commands and results recorded on audit day).

## G. Integration points for AI Core increments

1. **Inbound branch** — after message persist in `ConversationsService` (gateway vs legacy).  
2. **Generation** — `SalesAgentRuntimeService` → `AiModelRouter` (do not touch commerce ownership).  
3. **Mode** — `SALES_ENGINE_MODE` (`legacy` \| `sales-engine-v2` \| alias `ai-core`).  
4. **Keep shared:** locks, memory, search, outbox, ops controller, playground.

## Verdict

Treat **sales-engine-v2 as AI Core v1**. Evolve in place: provider abstraction, understanding/memory depth, evaluation, controlled rollout. Do not introduce a second Nest “AI Core” app or duplicate order/payment logic.
