# AI Core — Conversation Understanding

Deterministic layer that interprets the buyer turn **before** catalog search or LLM generation. Source of truth: `apps/api/src/agent-runtime/conversation-understanding.ts` (+ `resolveSalesReference` in `sales-state.ts`).

## Principle

Architecture priority #3: **determinism first** for references, yes/no to closing questions, and quantity. The model must not rediscover the catalog when state already holds a selection.

## Turn pipeline

1. `observeBuyer` — facts, intents, quantity, topic change  
2. `resolveSalesReference` — ordinals, bundle vs unit, color, price extremes, unique name fragments, “ese/este”  
3. `understandBuyerTurn` — pending seller ask, purchase confirmation, declines, option-pick cues  
4. Runtime pins `matches` to the selected/anchored product when buying or in `PRODUCT_SELECTED`  
5. LLM/deterministic reply — prompt forbids re-asking “qué producto buscas” if a product is already chosen  

## Pending seller asks

| Ask | Detected from last agent message |
| --- | --- |
| `prepare_purchase` | “¿te lo preparo/reserve?”, “para la compra”, payment link offer |
| `choose_option` | “¿cuál prefieres?” / “¿cuál te gusta?” |
| `district` | asks for distrito |

Affirmatives (`sí`, `dale`, `sí sólo uno`, `lo quiero`, …) against `prepare_purchase` ⇒ purchase confirmation. Soft declines (`no`, `no gracias después`, `luego`) clear the offer without checkout. Bare `sí` without a prepare-ask does **not** invent a purchase.

## Product references (recommended list only)

- Ordinals: primero…quinto, último (slot-stable if a product was deactivated)  
- Bundle vs unit (cualquier rubro): “el que viene sólo”, “quiero sólo…”, “quiero solo”, “X solo”, “no quiero el set/pack”, “sin el kit”. Tras rechazar un pack, no se reancla ni se resuelve la referencia al mismo set. Preferencia de unitarios sobre packs si el comprador no pidió combo. Detección de pack por nombre/categoría genérica (`set|kit|pack|combo|paquete|bundle|…`), no por industria.  
- “el más barato / más caro”, “el otro”, color  
- Unique token of the message present in exactly one recommended name (vocabulario del catálogo del tenant)  
- “me interesa / me gusta / prefiero / ese / este” with a single current option or prior selection  
- Seller pick: “cuál me recomiendas de todos”, “cuál es el mejor”, “tú cuál eliges” → keep recommended list, pick the first (best-first), never restart discovery  


Missing IDs never shift an ordinal onto another product.

## Runtime guards

- After confirmation, `selectedProduct` / single context product wins over a fresh search.  
- Deterministic empty-catalog fallback must not say “cuéntame qué producto buscas” when a selection exists.  
- Prompt: if `salesState.selectedProduct` is set, continue checkout (quantity / district / confirm), never restart discovery.

## Evaluation

Golden cases in `docs/agent/evals/sales-engine.json` (ordinals, “sí quiero uno”, “sí sólo uno”). Unit specs: `conversation-understanding.spec.ts`, `processing-lanes.spec.ts`, `sales-engine.spec.ts`.

**Training gate (preferred over manual chat):** `npm run train:ai-core` runs the multinicho gap curriculum in `docs/agent/evals/ai-core-training.json` and writes `ai-core-training-report.json`. Add a case there for every new Understanding gap before closing the fix.

## Extending

Add patterns in `conversation-understanding.ts` or `resolveSalesReference` with a focused unit test and a golden case. Prefer deterministic rules for Spanish sales deixis; do not teach the LLM to invent products or prices.

**Training workflow (multinicho):** `.agents/skills/vendedoria-ai-core-training` — Collect → Diagnose → Deterministic fix → Prompt/validator guard → Golden eval. Gap curriculum in that skill’s `references/gap-matrix.md`. Never ship vertical-only rules.
