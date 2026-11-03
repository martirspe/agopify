# AI copilot inside the store editor

The editor AI drafts **merchant-facing store copy/media**. It is **not** the WhatsApp/Instagram sales agent (`agent-runtime`). Separate quotas, prompts and permissions.

## Existing endpoints

| Route | Job |
| --- | --- |
| `POST …/editor/ai/text` | Field-level: write / shorter / persuasive / friendly / fix |
| `POST …/editor/ai/section` | Fill or refresh one section’s text fields |
| `POST …/editor/ai/page` | Multi-section page pass (exclusions apply) |
| `POST …/editor/ai/image` | Generate image for an image field (stricter rate limit) |

Implementation: `StorefrontAiService` + `store-ai-text.ts` / `store-ai-image.ts`. Console: `store-editor.page.ts` + `store-editor.ai.scss`.

## UX contract (`UX-UI-MASTER-SYSTEM` §40, §44)

Required loop for any AI control:

**Generar → Generando… → Resultado → Aplicar | Regenerar | Descartar**

- Persist feedback for multi-second calls; do not freeze the whole editor.
- One clear affordance per job (rewrite this title, fill empty section, refresh home). No scattered sparkle buttons.
- Applying writes into the **draft** only; publish remains a separate merchant action.
- Show what will change (field list / diff snippet) before apply when the patch spans many fields.

## Grounding rules

Prompts already pull business facts (industry, categories, product samples). Preserve and extend that pattern:

- Prefer catalog-truth names and categories over invented assortment.
- Never invent price, stock, shipping cost, payment methods, certifications or fake social proof.
- Respect `AI_EXCLUDED_BLOCKS` / `AI_PAGE_EXCLUDED_*` / `AI_IMAGE_EXCLUDED_BLOCKS`; add new exclusions when a field is structural or legal.
- Output must map onto **schema fields** (labels → ids). Reject or strip keys not in `TEMPLATE_SECTIONS`.
- Locale: Spanish copy for merchants/buyers; keep identifiers English.
- Timeouts already differ (text < page < image); stay under nginx proxy limits.

## Structured patch pattern (preferred evolution)

Treat AI responses as patches, not documents:

```ts
// Conceptual — align names with existing DTOs when extending
type EditorAiPatch = {
  layout?: StoreLayoutItem[];          // optional reorder/hide/add known types only
  sections?: Record<string, Record<string, string>>; // sectionId → fieldId → value
  theme?: Partial<StoreEditorTheme>;   // only bounded options
};
```

Server validates against schema + caps (lengths, choice enums, max blocks/FAQ). Client applies immutably through `template-editor.ts` helpers (`withField`, `withLayout`, …) so undo/`ContentHistory` keep working.

## Intent modes to prefer over raw chat

| Intent | Maps to |
| --- | --- |
| Empty store → first draft | page AI + default layout for industry/template |
| “Más vendedor” on a line | text action `persuasive` |
| Fill this section | section AI |
| Swap hero photo | image AI + media upload pipeline |
| “Más corto el anuncio” | text action on announcement fields |
| Suggest missing blocks | propose `HOME_BLOCKS` ids + defaults; merchant confirms add |

Natural-language chat is optional sugar: parse to one of the intents above. Do not open an unconstrained agent that edits the live DOM.

## Quality bar for “next level” AI

1. **Deterministic apply** — same schema validation as manual edits.
2. **Brand voice** — use storefront display name, industry and existing sibling fields as context.
3. **Conversion-aware** — CTAs and FAQ answers must not contradict payments/shipping settings; reuse shared FAQ builders when present (`core/store-faq.ts` patterns).
4. **Safe images** — media service pipeline, sizes from `store-ai-image`, no hotlinked random URLs in content.
5. **Observable failures** — Spanish errors, quota exhausted, model down; keep draft intact.
6. **Eval hooks** — when changing prompts, add/adjust focused unit tests on prompt builders and pickers (`pickSectionTexts`, exclusions), not only UI.

## Anti-patterns

- Coupling store-editor AI to sales-engine tool calling or conversation memory.
- Auto-applying patches on stream completion without Aplicar.
- Generating sections the template cannot render.
- Claiming SEO/CWV wins from AI copy without measurement.
