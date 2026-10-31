# AI Core — vertical slices (v2)

Aligned with Part A §8 of the v2 prompt. Code substrate = `sales-engine-v2`.

| Stage | Exit gate | Status |
| --- | --- | --- |
| **0 Audit** | `REPOSITORY_AUDIT`, `BASELINE`, `DEPENDENCY_MAP`, `DECISIONS` | **Done** |
| **1 Foundation** | Provider port, kill/rollback, **SHADOW** without customer send | **Done** |
| **2 MVP slice** | WhatsApp + scenarios A,C,D,G,H,J; 0 unsupported claims on golden subset | **Done** (lanes + multi-question + golden 21–26; voice notes still deferred) |
| **3 Memory** | B, E, F | **Done** (`memory-policy`, gateway merge, golden 27–29, retention/isolation tests) |
| **4 Sales/tools L2** | Scenario I; 0 duplicate orders | **Done** (`order_draft_hash` + `Order.checkoutKey` chat idempotency, golden 30) |
| **5 Resilience** | K, L, prompt injection | **Done** (security events K, provider fallback L, injection M + playground send fix) |
| **6 Eval + UI** | CI eval + Angular settings/analytics | **Done** (CI `eval:sales`, versioned dataset, agent analytics API + Advanced UI) |
| **7 Migration** | Shadow → canary → selected agents | **Done** (shipped, then **retired** before prod customers: defaults `ai_core`, console motor/migration UI removed; see `MIGRATION.md`) |
| **8 Hardening** | Post-migration security bounds | **Done** (manager-only mode API, playground rate limit, shadow artifact sanitize + dry-run tests) |
| **8b Playground fidelity** | Channel-parity preview for prod tests | **Done** (same prompt/pause/photos; dry-run commerce; `PLAYGROUND.md`) |
| **9 Product cutover** | AI Core only for new tenants | **Done** (schema/create default `ai_core`; progressive rollout endpoints/UI removed) |

## Working rule (v2)

At each stage end: report changes, real test results, risks, open decisions, exit-gate status — wait for approval before the next stage. Within a stage, implement autonomously.

## Non-goals

Second backend; parallel catalog; LLM SQL; Qdrant as price authority; global force-enable; claiming live-model quality from fixtures alone.
