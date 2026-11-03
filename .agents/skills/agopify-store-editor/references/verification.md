# Store editor — verification

Run the narrowest set that covers the touch surface. State skips explicitly (e.g. Docker down).

## Commands

| Changed | Run |
| --- | --- |
| Console editor UI / `template-editor` | `npm run build:web`; `npm run test -w @agopify/web` (store-editor / template-editor specs) |
| Bridge, directives, store layout | `npm run build:store`; `npm run test -w @agopify/store -- --watch=false` |
| `TEMPLATE_SECTIONS` / themes / ABI | `npm run theme:check` · `npm run theme:test` · `npm run theme:test:store` |
| AI service / draft API | `npm run build:api`; focused jest under `storefront/` via Docker exec when stack is up |
| `packages/contracts` messages | all three app builds |

## Manual (dev stack)

1. Open console `/app/store/editor` for a tenant with store add-on.
2. Confirm iframe loads store with editor chrome; selecting a section highlights preview and inspector.
3. Edit text → debounced draft save → reload editor → value persists; public store unchanged until publish.
4. AI text: Generar → suggestions → Aplicar → draft only; Descartar leaves prior value.
5. Add/hide/reorder block within caps; preview updates; publish then buyer host shows changes.
6. Mobile console width: structure/inspector reachable; device toggle works.
7. Theme incompatibility path: blocked with recovery, no silent data loss.

## Evidence rules

- Compilation ≠ visual proof. If preview wasn’t exercised, say so.
- Product-visible changes: `CHANGELOG.md` → `[Unreleased]`.
- Security-sensitive token/CSP changes: note `agopify-security` checks performed.
