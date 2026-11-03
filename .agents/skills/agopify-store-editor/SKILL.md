---
name: agopify-store-editor
description: Evolves Agopify's visual store editor (home-assistant floating composer → dock panel + dominant preview + Structure/Inspector drawers) and its AI copilot for structured sections, drafts, themes and preview bridge — never a free-form page builder or Aloja-style code project. Use when the user asks for editor de tienda, editor visual, page editor, AI editor/copilot de textos/secciones/imágenes, TEMPLATE_SECTIONS, store-editor, preview iframe, o llevar el editor al siguiente nivel.
---

# Agopify — modern AI store editor

Raise the merchant **visual store editor** toward best-in-class AI-assisted site editing **inside Agopify’s bounded model**. Do not rebuild Webflow/Framer/Shopify as a free canvas.

## Product stance (non-negotiable)

| Do | Do not |
| --- | --- |
| Compose reviewed sections/blocks from schemas | Invent arbitrary HTML/CSS/JS or plugin runtimes |
| AI proposes **structured patches** the merchant reviews | Auto-publish AI output or invent prices/stock/shipping |
| Preview = real framed storefront via signed `?editor=` | Fake canvas that diverges from buyer SSR |
| Content ≠ presentation ≠ layout | Bake styling into content blobs or free CSS |
| Spanish merchant UX; English code/ids | Competitor naming/copy or “✨ IA” spam |

Authority when docs disagree with code: executable contracts win; add one line to `docs/agent/context-map.md` → Discrepancies. Product UX headings: `docs/UX-UI-MASTER-SYSTEM.md` **§37–40, §44** (read by heading only). Themes: `docs/THEMES.md`. Positioning: `docs/plan-tienda-web.md` — *no editor de páginas libre*.

## Complementary skills

| Surface | Skill |
| --- | --- |
| Console chrome, DSM, sticky actions | `agopify-ui` |
| Template art direction / CRO of buyer pages | `agopify-storefront-premium` |
| Auth, preview tokens, iframe CSP, public store IDOR | `agopify-security` |
| Schema / draft persistence | `agopify-data` |
| Generic feature plumbing | `agopify-implement` |

This skill owns **editor UX, bridge contracts, section schemas for editability, AI copilot loops and draft/publish editor flows**. Template beauty alone → storefront-premium. Pure console polish with no editor semantics → ui.

## Load order (minimal)

1. This file.
2. `apps/web/AGENTS.md` + `apps/store/AGENTS.md` (editor paragraphs).
3. Only the reference the task needs:
   - [architecture.md](references/architecture.md) — files, bridge, schema, draft lifecycle
   - [ai-copilot.md](references/ai-copilot.md) — text/section/page/image AI, grounding, UX states
   - [evolution.md](references/evolution.md) — “next level” levers ranked by leverage
   - [verification.md](references/verification.md) — builds/tests/manual checks
4. Touched code siblings only. Expand when a contract is missing.

## Mental model

```
Merchant intent → structured mutation → draft → live preview → publish
                      ↑
              AI copilot (optional)
```

Three layers (keep separate):

1. **Content** — `templateContent` / `templateDraft` field values (`section.field`).
2. **Layout** — `layouts` order/visibility + library blocks (`type-xxxxxx`).
3. **Presentation** — theme identity/release + bounded merchant theme options (`--store-*`).

AI and UI must mutate **one layer at a time** with an explicit apply/discard path. Never collapse layers into a rich-text blob or generated stylesheet.

## Workflow

Copy and track only what the request covers:

```
- [ ] 1 Diagnose: current affordance vs target (see evolution.md)
- [ ] 2 Confirm contract: TEMPLATE_SECTIONS / HOME_BLOCKS / bridge messages / AI DTO
- [ ] 3 Design the merchant loop (select → edit/AI → preview → save → publish)
- [ ] 4 Implement API → contracts → store directives/render → console editor (minimal path)
- [ ] 5 Wire AI as structured patch + Generar/…/Aplicar/Descartar when AI-touched
- [ ] 6 Verify (verification.md); CHANGELOG [Unreleased] if product-visible
```

### Implementation rules

- **Schema-first.** New editable surface = entry in `TEMPLATE_SECTIONS` (and `HOME_BLOCKS` if library), `case` in every template home that needs it, store directive key `section.field`, console inspector field kind. Missing schema = invisible to editor and AI.
- **Bridge-safe.** Host ↔ frame messages stay in `packages/contracts` (`StoreEditorHostMessage` / `StoreEditorFrameMessage`). Origin allow-list + signed editor token; no open `postMessage`.
- **Real preview.** Console iframe loads the tenant store with `?editor=`; do not duplicate a second renderer for “edit mode” visuals beyond selection chrome.
- **Draft honesty.** Never label draft-only changes as published. Preserve versions/restore semantics already in the editor.
- **AI = copilot.** Quota-aware; grounded on business + catalog facts already used by `StorefrontAiService`; merchant must apply. No invented scarcity, reviews, payments or legal claims.
- **Mobile console.** Structure/Inspector remain operable; device preview toggles stay reachable (`agopify-ui` responsive rules).
- **Minimal coherent change.** No speculative DnD, free CSS, ZIP themes or new deps unless the task explicitly requires them and contracts exist.

## Decision tree

| User ask | First move |
| --- | --- |
| “Mejorar el editor / siguiente nivel” | Read [evolution.md](references/evolution.md); pick the highest-leverage lever that fits the ask; propose short plan before coding if multi-file |
| New section/block editable | architecture.md → schema + all template homes + inspector |
| AI write/rewrite/fill page | ai-copilot.md → extend prompts/DTO/UI states, not a parallel LLM stack |
| Selection / inline edit / inspector sync | bridge + directives in `store-editor.ts`; keep keys schema-valid |
| Theme picker / release break | `docs/THEMES.md` + security; editor must explain → block unsafe → recover |
| Looks only on buyer store | hand off to `agopify-storefront-premium` |

## Delivery

Report: what lever moved, contracts touched, AI states if any, verification run, residual gaps. Do not claim Framer/Webflow parity or free page-building. Do not invent visual QA evidence.
