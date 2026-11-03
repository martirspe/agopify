---
name: agopify-ai-core
description: Evolve Agopify AI Core as a hybrid layer over the existing sales-engine-v2 runtime — multi-model providers, memory/understanding increments, feature flags and migration without rewriting channels or commerce. Use for AI Core, multi-provider LLM, SALES_ENGINE_MODE=ai-core, or progressive agent migration; defer TikTok LIVE and merchant coaching.
---

# Agopify AI Core

AI Core is **not** a greenfield rewrite. The durable sales engine (`sales-engine-v2`) is AI Core v1. Evolve in place.

## Read first

1. `docs/ai-core/REPOSITORY_AUDIT.md` and `ARCHITECTURE.md` (mapping table).
2. `docs/AI-SALES-ENGINE.md` for operational invariants.
3. Personal skill `agopify-ai-sales-engine` for lock/memory/tool/guardrail rules.
4. Implement via `agopify-implement`; schema via `agopify-data`; webhooks/money via `agopify-security`.

## Code map

| Responsibility | Path |
| --- | --- |
| Durable inbox / outbox | `conversations/sales-gateway.service.ts` |
| Orchestration | `agent-runtime/sales-agent-runtime.service.ts` |
| Model port / OpenAI / router | `agent-runtime/models/` |
| Tools / memory / search / state | `sales-tool-registry`, `sales-memory`, `sales-search`, `sales-state` |
| Mode | `SALES_ENGINE_MODE`: `legacy` \| `sales-engine-v2` \| `ai-core` (alias of v2) |
| Per-agent override | `SalesAgent.aiRuntimeMode`: `inherit` \| `ai_core` \| `legacy` |
| Multi-intent | `buyer-intents.ts` → `SalesState.intents` |
| Provider | `SALES_MODEL_PROVIDER` (default `openai`) |

## Rules

- Inspect before adding modules; reuse catalog, orders, payments, knowledge.
- PostgreSQL owns structured memory; Redis is hot context; Qdrant returns IDs only.
- LLM never executes SQL or unrestricted writes; commerce stays in backend services.
- Tenant from JWT/channel resolution, never from model args.
- Product default is AI Core (`ai_core` / `sales-engine-v2`). Legacy/shadow remain ops/test overrides only; see `docs/ai-core/MIGRATION.md`.
- Document implemented behaviour under `docs/ai-core/`; update `CHANGELOG.md` for product-visible changes.
- Conversation quality / Understanding gaps (ordinals, sí/sólo uno, pack vs unit, sold-out, continuity): use sibling skill `agopify-ai-core-training`. **Every fix must be multinicho** — no vertical-only regexes.

## Verify

```bash
docker compose -f docker-compose.dev.yml exec -T api npx jest agent-runtime --runInBand
npm run build:api
npm run eval:sales -w @agopify/api
```
