# AI Core — conversation gap matrix

Use this as the curriculum checklist. Close gaps with deterministic Understanding + sellable
filters + validator/prompt guards. Every row must stay **niche-agnostic**.

## A. Reference & deixis

| ID | Buyer signal (examples) | Expected | Primary layer |
| --- | --- | --- | --- |
| A1 | Ordinal: primero…quinto, último, el de arriba | Pin `recommendedProductIds[i]` even if a later SKU was deactivated | `resolveSalesReference` |
| A2 | “ese / este / el otro” | Resolve against current recommended list or selection | `resolveSalesReference` |
| A3 | Color / cheapest / most expensive | Resolve within current matches | `resolveSalesReference` |
| A4 | Unique name token from tenant catalog | Match exactly one recommended name | `resolveSalesReference` |
| A5 | “me gusta / me interesa / prefiero” with one option | Select that product | Understanding + state |
| A7 | “cuál me recomiendas / cuál es el mejor / de todos” | Pick among `recommendedProductIds` (best-first); never restart discovery | Understanding + runtime |
| A6 | Missing ID in list | **Never** shift ordinal onto another product | `sales-state` |

## B. Closing & confirmation

| ID | Buyer signal | Expected | Primary layer |
| --- | --- | --- | --- |
| B1 | After prepare-offer: sí, dale, ok, perfecto | Confirm purchase of selected / single match | `confirmsPurchase` |
| B2 | “sí quiero uno / sí sólo uno / quiero uno” | Affirmative + qty=1, still purchase | Understanding |
| B3 | Bare “Sí” after “¿te lo preparo?” | Purchase, not rediscovery | Pending ask = `prepare_purchase` |
| B4 | Soft decline: no / después / luego | Do not force checkout | Understanding |
| B5 | Affirmative without pending prepare | Do not invent a purchase | Understanding |

## C. Quantity & packing

| ID | Buyer signal | Expected | Primary layer |
| --- | --- | --- | --- |
| C1 | “uno / dos / tres” after ask | Persist quantity | `observeBuyer` |
| C2 | Unitario vs pack: “sólo la X”, “sin el set/kit/pack”, “el completo” | Filter or select using **structural** pack cues + catalog vocab, not industry words | Understanding + tools |
| C3 | Buyer names a SKU that is a pack | Prefer pack SKU when they ask for pack/completo | Understanding |

## D. Inventory & catalog honesty

| ID | Failure mode | Expected | Primary layer |
| --- | --- | --- | --- |
| D1 | Sold-out in search/browse results | Exclude from sellable pool | Tools / registry |
| D2 | LLM volunteers “X está agotado” unasked | Reject or avoid; only discuss OOS if buyer named it | Prompt + validator |
| D3 | Price / stock invented | Validator + tools only | Validator |
| D4 | Recommend then discover OOS mid-turn | Prefer available alternatives; never present OOS as buyable | Runtime |

## E. State continuity

| ID | Failure mode | Expected | Primary layer |
| --- | --- | --- | --- |
| E1 | After selection, agent asks “qué producto buscas” | Continue checkout path | Runtime + prompt |
| E2 | Topic change clears wrong selection | Clear only on clear topic shift | `observeBuyer` |
| E3 | Operator pause | Agent silent until reactivation | Gateway / pause |
| E4 | District / shipping ask | Capture district; do not restart catalog | Pending ask |

## F. Voice & UX copy (Spanish)

| ID | Failure mode | Expected | Primary layer |
| --- | --- | --- | --- |
| F1 | Robotic “Encontré esto en el catálogo” | Natural, short Spanish intros | Deterministic reply builders |
| F2 | Competitor-like or English microcopy | Brand-safe Spanish | Copy rules |
| F3 | Overlong product dumps | Concise options with clear next ask | Playbook |

## G. Multi-intent & edge

| ID | Signal | Expected | Primary layer |
| --- | --- | --- | --- |
| G1 | Product + shipping in one turn | Capture both intents without dropping selection | `buyer-intents` |
| G2 | FAQ / policy while buying | Answer from knowledge; keep sales state | Knowledge tools |
| G3 | Ambiguous message | Prefer clarifying question over wrong SKU | Understanding |
| G4 | Empty catalog for query | Honest empty state; no invented SKUs | Tools + fallback |

## Coverage discipline

- When closing a gap, add or update: unit test + (when turn-level) golden eval.
- Prefer extending the matrix row over inventing ad-hoc one-off patches.
- New Spanish colloquialisms: add to Understanding with multinicho fixtures (see `multi-niche.md`).
