# Agopify AI Core — Architecture (v2, adapted)

**Version:** 2.0.0 (adapted to repository evidence)  
**Source:** Part A of *Agopify AI Core v2*; executable code wins.  
**Status:** Living — `apps/api/src/agent-runtime/` + `conversations/sales-gateway.service.ts`.

## 1. Vision and principles

Shared engine that turns configurable sales agents into digital sellers with memory, verified knowledge and permissioned commercial actions. Channels only transport messages.

**Central rule:** the model reasons and proposes; the backend validates, authorizes and executes.

Priority when principles conflict:

1. Tenant security and isolation  
2. Commercial truth (price/stock/promos from authoritative services at reply time)  
3. Determinism first (regex, SQL, ordinal references — not LLM)  
4. Compatibility (legacy stays; activate/disable per agent)  
5. Measurable quality  
6. Transparency (natural, never pretend to be human)

## 2. Architectural decisions

### 2.1 Hybrid — evolve in place

AI Core is **not** a new microservice. The durable sales engine (`sales-engine-v2`) **is** AI Core v1 substrate. Evolve adapters, lanes, modes and tools there.

| Spec concept | Repository home |
| --- | --- |
| Channel Gateway | `channels/` + `conversations.service` + `sales-gateway` |
| Conversation Manager | `SalesGatewayService`, `Conversation` / `Message` / `SalesEngineTurn` |
| Understanding | `conversation-understanding.ts`, `buyer-intents.ts`, `conversation-context.ts`, `observeBuyer`, `resolveSalesReference` (see `UNDERSTANDING.md`) |
| Memory | `sales-memory.service.ts`, `salesState`, `SalesCustomerMemory`, Redis `wa:state:*` |
| Knowledge | Tenant FAQ by topic + policy templates (`knowledge/`); `lookupFaqs` topic boost; `sales-search` embed includes topic (Qdrant→PG) |
| Sales | `sales-state` stages + runtime |
| Tools | `sales-tool-registry` (L0) + backend order/payment (L2) |
| Response / validator | `sales-agent-runtime`, `sales-response-validator` |
| Models | `agent-runtime/models/` |
| Evaluation | `sales-evaluation`, `docs/agent/evals/` |

### 2.2 Modes (per agent + env)

**Product default:** every new agent is `ai_core`; `SALES_ENGINE_MODE=sales-engine-v2` (alias `ai-core`). Progressive console rollout was retired (no production tenants yet).

| Mode | Behaviour |
| --- | --- |
| `ai_core` | Durable inbox, memory, tools, Meta delivery (**default**) |
| `inherit` | Follow `SALES_ENGINE_MODE` |
| `shadow` | Durable process + record; **never send**; commerce dry-run (ops/tests) |
| `legacy` | Sync generate+send (ops rollback only) |

Exactly one response path per inbound message. See `MIGRATION.md`.

### 2.3 Autonomy by risk (L0–L3)

| Level | Policy (default) | Today in repo |
| --- | --- | --- |
| L0 read | Autonomous | Model tools in `SalesToolRegistry` |
| L1 reversible write | Autonomous + audit | Preferences / memory writes (backend) |
| L2 commercial commit | Explicit customer confirmation + idempotency | Order + payment link in runtime (not model tools); `order_draft_hash` → `Order.checkoutKey` (see `ORDER_IDEMPOTENCY.md`). If Flow B payments are not configured, the order is still created and the turn hands off (`payment_provider_missing`) — never invent a link or chat transfer instructions |
| L3 irreversible / out of policy | Human only | Handoff / escalate |

Businesses may tighten; never relax above L2 without product change.

### 2.4 Processing lanes

Orchestrator picks lane with cheap signals (no extra LLM call):

- **Fast:** greetings, ack, ordinals, pending yes/no, deterministic district — already partially in runtime  
- **Standard:** structured understanding (deterministic multi-intent + optional one model call) + tools + one generation; fact validation deterministic  
- **Complex:** multi-tool, objections, quotes — capped iterations (`SALES_TOOL_TIMEOUT_MS`, tool rounds)

### 2.5 Multi-model

`AiModelProvider` + `AiModelRouter`; OpenAI adapter first. Fallback only to capability-equivalent providers; else safe degradation / handoff.

## 3. Memory and knowledge

PostgreSQL authoritative for structured memory. Redis for working buffer/locks/hot state when available. Qdrant for semantic **candidate IDs** only (keep; see `DECISIONS.md`). Never read price/stock/payment from memory or summaries.

## 4. Vertical delivery (v2)

Stages 0–8 + playground fidelity completed; AI Core is the production sales path. Exit gates in `IMPLEMENTATION_PLAN.md`.

## 5. Acceptance

Measurable thresholds in Part A §9 of the v2 prompt; golden set under `docs/agent/evals/`. Naturalness = continuity, relevance, coherence, repetition — not “sounds human”.
