# Store editor — architecture map

Read this when changing schemas, bridge, draft/publish or inspector wiring. Code paths beat this file.

## Surfaces

| Role | Path |
| --- | --- |
| Console shell (Structure \| Preview \| Inspector) | `apps/web/src/app/features/store/store-editor.page.{ts,html,scss}` (+ `store-editor.*.scss`) |
| Pure content/layout helpers | `apps/web/src/app/features/store/template-editor.ts` |
| Console API client | `apps/web/src/app/core/api/store-api.service.ts` |
| Draft/publish/versions HTTP | `apps/api/src/storefront/storefront-editor.service.ts` + controller |
| Section schema / defaults | `apps/api/src/storefront/store-templates.ts` (`TEMPLATE_SECTIONS`, `HOME_BLOCKS`) |
| AI writing/images | `apps/api/src/storefront/storefront-ai.service.ts`, `store-ai-text.ts`, `store-ai-image.ts` |
| Preview bridge + directives | `apps/store/src/app/core/store-editor.ts` (`STORE_EDITOR`, `storeEditText`, `storeEditImage`, `storeSection`) |
| Home composition | `apps/store/src/app/core/store-layout.ts` + each template home `@for`/`@switch` |
| Shared block render | `apps/store/src/app/components/home-block.component.ts` |
| Frame CSP / editor origin | `apps/store/src/server.ts` (`STORE_EDITOR_ORIGIN`, `?editor=` token) |
| Shared types | `packages/contracts` — `StoreEditor*`, `StoreLayoutItem`, template content |
| Themes (presentation) | `packages/themes/`, `docs/THEMES.md` |

## Document model

```
StoreTemplateContent
  sections: { [sectionId]: { [fieldId]: string } }
  layouts?: { [template]: StoreLayoutItem[] }   // id, type, hidden?
  theme?: merchant theme options
  faq?: …
```

- Builtin section ids are stable (`hero`, …). Library blocks use `type-xxxxxx`.
- Empty string can **hide** an element; missing key = template default.
- `role`: `builtin` | `block` | `fixed`. Fixed sections may declare `page` so the host calls `openPage`.

## Host ↔ frame protocol

- Frame → host: `snapshot` (values, selection hints).
- Host → frame: apply content, `select` section (+ optional `page`), navigation locks while editing.
- Sources: `agopify-store` / `agopify-editor` only; validate `event.origin`.
- Editing chrome: `html.store-editing`; clicks/forms must not navigate the buyer store away.

## Schema change checklist

1. Add/adjust field in `TEMPLATE_SECTIONS` for every template that exposes it (or shared block).
2. If library block: `HOME_BLOCKS` + `@default`/`sharedBlockType` path or dedicated `case`.
3. Store: directive key `section.field` on real markup; page-copy helpers for fixed off-home sections.
4. Contracts: field kinds (`text` | `multiline` | `image` | `choice` | `url`) and messages if new ops.
5. Console: inspector renders from schema; AI exclusion lists if the field must not be generated.
6. Server validate/sanitize on draft save (whitelist fields; no raw HTML injection).
7. Tests: template-editor / store-editor specs + theme checks when manifests change.

## Draft lifecycle

`templateDraft` → save (autosave/debounce in console) → publish → `templateContent`. Versions/restore live on the editor service. UI must distinguish pending / saving / saved / error and draft vs live.

## Security touchpoints

- Preview/editor tokens: signed, short-lived, httpOnly where applicable; never log tokens or PII.
- `frame-ancestors` only `STORE_EDITOR_ORIGIN` for editor requests.
- Tenant id from auth on console AI/draft routes; never from client-chosen store id.
- Rate limits: `store-editor-ai`, `store-editor-ai-image`.
- Plan quota for AI texts/images separate from sales-agent replies.

## Anti-patterns

- Second “editor renderer” that does not use the store app.
- Storing merchant CSS/JS or unreviewed Markdown/HTML.
- DnD or free positioning without layout contract support.
- Reading constitution/theme docs whole; use headings + this map.
