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

**Open product need** (`isOpenProductNeed`: “quiero comprar un X”, “busco Y”, “necesito Z”, “quiero ver …”, “muéstrame productos de…”): starts catalog discovery and **releases** a stuck district ask. It must **not** resume a prior pending checkout / remembered district into an order. Singular “muéstrame el producto” is presentation of the current SKU (E5), not a new search. Anaphora checkout (“comprarlo”, “lo quiero”, “dame el link”) stays on the current SKU. A named SKU in the same phrase (“quiero comprar Perfume X”) may enter checkout; quoted shipping still asks confirmation before creating the order.

**Cancel / abandon** (`wantsCancelOrder`: “cancelar el pedido”, “ya no lo voy a comprar”): cancels an unpaid chat order (DRAFT / PENDING_PAYMENT) or hands off if already paid. Must never loop “Ya tienes un pedido pendiente” when the buyer is cancelling or starting a new catalog need.

## Pending seller asks

| Ask | Detected from last agent message |
| --- | --- |
| `prepare_purchase` | “¿te lo preparo/reserve?”, “para la compra”, payment link offer |
| `choose_option` | “¿cuál prefieres?” / “¿cuál te gusta?” |
| `district` | asks for distrito |

Affirmatives (`sí`, `dale`, `sí sólo uno`, `lo quiero`, …) against `prepare_purchase` ⇒ purchase confirmation. Soft declines (`no`, `no gracias después`, `luego`) clear the offer without checkout. Bare `sí` without a prepare-ask does **not** invent a purchase.

While district/checkout is pending, “quiero ver foto” / “muéstrame el producto” still sends the selected product image and re-asks the district — the presentation request is never ignored. FAQ questions use published knowledge. Discount / oferta / cupón questions use **only** active coupons in vigencia (`listActivePublishedDiscounts`) or a catalog sale price (`compareAt`); if none, the agent says there are no published active discounts — never invents %.

**Option selection vs checkout:** after the agent listed options, “quiero el X” / “quiero esa” pins that SKU and asks “¿Te lo preparo?” — it must **not** jump to the district ask. District is asked only after prepare confirmation, anaphora commit (“lo quiero”, “quiero comprarlo”, payment link), or a remembered district reply.

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
