---
name: vendedoria-ai-core-training
description: >-
  Professionally harden VendedorIA AI Core conversation quality across every merchant niche —
  deterministic understanding, references, confirmations, inventory grounding, prompts and
  golden evals. Use when the user asks to entrenar/endurecer/mejorar el Core AI or the sales
  agent, or when chat transcripts show gaps (ordinals, “sí/sólo uno”, unitario vs set,
  agotados, reinicio de discovery, copy robótico). Complements vendedoria-ai-core; does not
  replace locks/commerce (vendedoria-ai-sales-engine) or TikTok LIVE.
---

# VendedorIA — AI Core training (conversation hardening)

“Entrenar” aquí **no** es fine-tuning de pesos. Es el ciclo profesional Collect → Diagnose →
Deterministic fix (preferred) → Prompt/validator guard → Golden eval → Verify, sobre el runtime
híbrido existente (`sales-engine-v2` / AI Core).

## Hard rules (never violate)

1. **Multinicho obligatorio.** Ninguna regla, regex, test o golden case debe depender de un
   rubro concreto (desodorante, perfume, zapatilla, café…). Usa vocabulario del catálogo del
   tenant, señales estructurales (`set|kit|pack|combo|paquete|bundle`, ordinales, afirmaciones)
   y *hints* léxicos genéricos (“sólo la X”). Si un ejemplo de un vertical aparece en un test,
   incluye al menos otro vertical distinto en el mismo cambio.
2. **Determinismo primero** (ARCHITECTURE §1): referencias, sí/no a cierre, cantidad, unitario
   vs pack, filtros de stock. El LLM no inventa precio/stock/producto ni reabre discovery.
3. **Verdad comercial:** PostgreSQL + tools; Qdrant solo IDs; nunca cachear stock/precio.
4. **Mínimo coherente:** no reescribir canales, pagos ni el gateway; evolucionar
   `agent-runtime/` in place. Implementar vía `vendedoria-implement`.
5. **Sin PII en logs.** Sin secretos. Copy al comprador en español.

## When to use

- Transcripciones de playground/WhatsApp donde el agente pierde contexto, reinicia búsqueda,
  ofrece agotados, no entiende “el último / sí / sólo uno / sólo el producto”, o suena robótico.
- Pedidos explícitos: “entrenar el Core”, “endurecer understanding”, “mejorar el vendedor IA”,
  “huecos del agente”, “calidad conversacional”.
- Ampliación del golden set o de `conversation-understanding`.

**Do not use** for TikTok LIVE, merchant coaching, storefront UI, or pure schema/auth work
(use those domain skills instead).

## Read first (minimal)

1. This skill + [references/gap-matrix.md](references/gap-matrix.md) + [references/multi-niche.md](references/multi-niche.md).
2. `docs/ai-core/ARCHITECTURE.md` (principles) and `docs/ai-core/UNDERSTANDING.md`.
3. Root `AGENTS.md` + `apps/api/AGENTS.md`.
4. Personal skill `vendedoria-ai-sales-engine` for lock/memory/tool invariants.
5. Sibling skill `vendedoria-ai-core` for mode/migration map.

## Code map (understanding & quality)

| Concern | Path |
| --- | --- |
| Turn understanding | `apps/api/src/agent-runtime/conversation-understanding.ts` |
| Buyer intents | `buyer-intents.ts` |
| State / ordinals / refs | `sales-state.ts` (`observeBuyer`, `resolveSalesReference`) |
| Orchestration | `sales-agent-runtime.service.ts` |
| Catalog search / sellable pool | `sales-agent-tools.service.ts` |
| Model tools | `sales-tool-registry.service.ts` |
| Reply grounding | `sales-response-validator.ts` |
| Prompt / playbook | `sales-playbook.ts` + runtime system blocks |
| Golden evals | `docs/agent/evals/sales-engine.json` + `scripts/evaluate-sales-engine.cjs` |
| Training curriculum | `docs/agent/evals/ai-core-training.json` + `scripts/evaluate-ai-core-training.cjs` → `npm run train:ai-core` |
| Specs | `conversation-understanding.spec.ts`, `sales-engine.spec.ts`, `sales-agent-tools.service.spec.ts` |

## Training loop (execute in order)

### 1. Collect

- Capture the failing transcript (buyer/agent turns) **without** phones/emails in notes.
- Classify each failure using [gap-matrix.md](references/gap-matrix.md) (one primary gap + optional secondary).
- State the **niche-agnostic** expected behaviour in one sentence
  (e.g. “After prepare-offer, affirmative + quantity confirms purchase of selected SKU”).

### 2. Diagnose (evidence before code)

- Trace which layer should have won: `understandBuyerTurn` / `resolveSalesReference` /
  sellable filter / prompt / validator / LLM hallucination.
- Confirm whether `recommendedProductIds`, `selectedProduct`, and sellable `matches` are correct
  at the failing turn.
- Prefer a deterministic fix if the case is deixis, yes/no, quantity, pack-vs-unit, or stock.

### 3. Implement (priority order)

1. **Understanding / state** (`conversation-understanding`, `resolveSalesReference`, `observeBuyer`).
2. **Runtime anchors** (pin selected product; never empty-catalog “qué producto buscas” if selected).
3. **Sellable pool** (exclude stock-zero / `!isAvailable` from recommend + browse + tool merges).
4. **Validator** (reject invented OOS chatter, ungrounded prices, etc.).
5. **Prompt** only as a secondary guard (Spanish, niche-agnostic wording).
6. Never teach the model to invent catalog rows “to be helpful”.

Follow [multi-niche.md](references/multi-niche.md) for every pattern and fixture.

### 4. Lock with tests

- Unit: pattern + resolution + filter for **≥2 verticals** when the change is lexical/structural.
- Runtime: `sales-engine.spec` scenario that would have reproduced the transcript gap.
- Golden: add/adjust case in `docs/agent/evals/sales-engine.json` (use `recommended`, `selected`,
  `agentHistory` when the ask depends on the last agent turn). Bump `version` date if the suite shape changes.

### 5. Verify (automated — do not rely on manual chat)

Canonical training gate (build + gap-matrix curriculum offline):

```bash
npm run train:ai-core
```

Inside Docker api (also run Jest units):

```bash
docker compose -f docker-compose.dev.yml exec -T api npm run train:ai-core -w @vendedoria/api -- --skip-build --with-unit
```

Also keep the legacy golden set green:

```bash
npm run eval:sales -w @vendedoria/api
```

**Every new gap** must add a case to `docs/agent/evals/ai-core-training.json` (with `gap` + `vertical`) before closing the task. Report: `docs/agent/evals/ai-core-training-report.json`.

Update `docs/ai-core/UNDERSTANDING.md` when behaviour is product-visible; `CHANGELOG.md` `[Unreleased]`.

### 6. Report

- Gap id(s) closed, files touched, training report pass/fail, remaining open gaps from the matrix.
- Explicitly state that fixtures are **multi-niche** (list verticals used).
- Paste or summarize `gapsCovered` / `failCount` from the training report.

## Anti-patterns

- Hardcoding brand/category names (Yanbal, desodorante, SPF, etc.) into production regexes.
- Fixing only the user’s latest transcript without a regression test.
- Relying on the LLM to “remember” ordinals or stock.
- Recommending or narrating sold-out SKUs the buyer did not name.
- Robotic intros (“Encontré esto en el catálogo”) when a natural deterministic line exists.
- Broad refactors of gateway/Meta/payments under the guise of “training”.

## Relationship to other skills

| Skill | Role |
| --- | --- |
| `vendedoria-ai-core` | Modes, providers, migration substrate |
| `vendedoria-ai-sales-engine` | Locks, memory, tools, commerce guardrails |
| `vendedoria-implement` | How to land the code change |
| **This skill** | Conversation quality curriculum + multinicho hardening loop |
