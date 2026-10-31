# AI Core — decisions (evidence-based)

Updated: 2026-10-30 after v2 prompt review and Stage 0 audit.

## D1 — Do not rewrite; evolve `sales-engine-v2`

**Decision:** Treat durable sales engine as AI Core substrate.  
**Why:** Inbox, locks, tools, memory, validator, eval and WhatsApp/Instagram paths already exist.  
**Reject:** New Nest app / parallel catalog / greenfield “AI Core” package tree.

## D2 — Keep Redis for working memory

**Decision:** Continue Redis for buffer, lock, hot `salesState`, embedding cache.  
**Why:** Already wired via `ConversionInfrastructure`; PG remains durability for inbox/state.  
**Fallback:** If Redis down, gateway still drains from PostgreSQL.

## D3 — Keep Qdrant; do not add pgvector now

**Decision:** Keep Qdrant for sales semantic IDs + store affinity.  
**Why:** Collections, outbox (`SalesSearchJob`), tenant filters and lexical fallback already shipped.  
**Revisit:** Only if Qdrant ops cost outweighs benefit; then evaluate pgvector as a migration project, not a parallel index.

## D4 — Modes: `legacy` | `shadow` | `ai_core` (+ `inherit`)

**Decision:** Align with v2 LEGACY / SHADOW / AI_CORE.  
**Why:** v1 only had legacy vs durable; shadow is required before canary without double replies.  
**Shadow rules:** process + persist turn/trace; no Meta send; order/payment dry-run (same safety as playground).

## D5 — Deterministic multi-intent before LLM understanding call

**Decision:** Ship `buyer-intents.ts` rules first; optional structured LLM understanding later for ambiguous cases.  
**Why:** v2 “determinism first” and lower latency/cost; matches fast/standard lane split.

## D6 — Voice notes / Messenger / media inbound

**Decision:** Deferred until after SHADOW + MVP grounding gates.  
**Why:** Inbound today is text-only; transcription needs product + provider budget. Tracked as Stage 2 follow-up (scenario O).

## D7 — Stage gates

**Decision:** Follow v2 stop gates: document → implement → evidence → user approval before the next stage.  
**Current:** Stages 0–8 done. Voice notes / Messenger remain deferred (D6).

## D8 — Post-migration security bounds

**Decision:** After canary tooling ships, harden before expanding voice/media.  
**Why:** Cost abuse (playground), privilege (AGENT flipping canary) and shadow artifact leakage are higher priority than deferred channels.  
**Ship:** manager-only `aiRuntimeMode`, playground rate limit, shadow metadata sanitize.
