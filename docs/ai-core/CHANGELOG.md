# docs/ai-core changelog

## 2026-10-30

- Phase 0 audit package: `ARCHITECTURE`, `REPOSITORY_AUDIT`, `DEPENDENCY_MAP`, `BASELINE`, `IMPLEMENTATION_PLAN`, `MODEL_ROUTING`, `MIGRATION`.  
- Code: `agent-runtime/models` provider port + OpenAI adapter + router; `SALES_ENGINE_MODE` accepts `ai-core`; `SALES_MODEL_PROVIDER` env.  
- Skill: `.agents/skills/agopify-ai-core`.

## 2026-10-30 (continued)

- Per-agent `aiRuntimeMode` (`inherit` \| `ai_core` \| `legacy`) + migration `20261030220000_sales_agent_ai_runtime_mode`.  
- Ingest routing via `usesDurableAiCore` in conversations/gateway.  
- Multi-intent: `buyer-intents.ts` → `SalesState.intents`.  
- Console Advanced: Motor de inteligencia toggle.

## 2026-10-30 (v2 alignment)

- Adopted v2 ARCHITECTURE + `DECISIONS.md` + vertical-slice plan.  
- Added `shadow` mode (env + agent): durable turn, dry-run commerce, no Meta send.  
- Stage 1 exit gate: SHADOW without affecting live customers.

## 2026-10-30 (Stage 2 MVP)

- Processing lanes `fast` / `standard` / `complex` (`processing-lanes.ts`) recorded in turn traces.  
- Multi-question: factual deterministic coverage + prompt checklist + validator `unanswered_subquestion` for compound inquiries.  
- Golden set cases 21–26 (multi-pregunta, segundo en negro, corrección, handoff, precio, garantía).  
- `eval:sales` green (26 fixtures).

## 2026-10-30 (Stage 3 Memory)

- `memory-policy.ts`: `mergeCustomerMemory`, `applyTopicChange`, `knownFactsPromptBlock`, `isRepeatedKnownQuestion`, `durableCustomerFacts`.
- Gateway hydrates customer memory into `answeredQuestions`; destination/address stored as customer-scoped facts.
- `saveCustomer` persists only durable keys (never price/stock/payment).
- Golden cases 27–29 (question dedupe, topic change, returning memory) + unit/security specs.

## 2026-10-30 (Stage 4 Sales/tools L2)

- `order-draft-hash.ts`: canonical cart hash without PII; `chat:{tenantId}:{conversationId}:{hash}` checkout keys.
- `OrdersService.create` replays by `checkoutKey`/`requestHash` (incl. P2002 races); never returns another tenant's order.
- Sales state persists `orderDraftHash`; create_order traces mark `replayed`.
- Golden case 30 + idempotency unit tests.

## 2026-10-30 (Stage 5 Resilience)

- `prompt-injection.ts` + runtime refusal (scenario M); validator `unauthorized_discount`.
- `security-events.ts` for cross-tenant / order-scope denies (scenario K).
- `AiModelRouter`: capability-equivalent fallback once, `degraded` flag (scenario L).
- Playground: resilient send, tenant-scoped session updates, clearer console errors; composer click/Enter fix.
- Golden cases 31–33.

## 2026-10-30 (Stage 6 Eval + UI)

- Versioned `sales-engine.json` (`version` + `cases`); CI runs `eval:sales` after `build:api`.
- `GET /agents/:id/analytics` — tenant-scoped turn aggregates (no chat PII).
- Seller Advanced: «Actividad reciente» panel from real `SalesEngineTurn` traces.

## 2026-10-30 (Stage 7 Migration)

- `migration-policy.ts`: progressive phases (playground → shadow → canary → expand / rollback) + mode-change risk for audit.
- `GET /agents/migration-status` — tenant-scoped rollout snapshot (no PII); never flips global env.
- `ai_runtime_mode_changed` security event on per-agent mode updates.
- Console Advanced: «Migración progresiva» + safer motor hints; playbooks in `MIGRATION.md` / `OPERATIONS.md`.

## 2026-10-30 (Stage 8 Hardening)

- OWNER/ADMIN only for `aiRuntimeMode` changes (`assertManager`); audit detail includes role.
- Playground send rate limit `agent-playground-send` (20/min).
- Shadow delivery sanitizes live order/payment artifacts (`shadow_live_artifact_blocked`).
- Dry-run coverage for shadow/playground `create_order`.

## 2026-10-30 (Playground channel fidelity)

- Playground uses the same prompt/pause rules as production; dry-run only for commerce.
- Removes buyer-visible “simulado” notes from reply text; UI chrome explains the test CTA.
- Tracks product photos via `send_product_image` traces; resolves agent channel when assigned.
- `docs/ai-core/PLAYGROUND.md` production-test checklist.

## 2026-10-30 (Product cutover — AI Core only)

- New agents default to `ai_core`; unknown mode normalizes to `ai_core`.
- Removed `GET /agents/migration-status` and console motor / progressive-migration UI.
- `MIGRATION.md` / `OPERATIONS.md` updated: progressive rollout retired before production customers.
