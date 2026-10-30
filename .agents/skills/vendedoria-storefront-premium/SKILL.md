---
name: vendedoria-storefront-premium
description: Evolves VendedorIA tenant storefront templates toward luxury-grade ecommerce design on Angular 22, Tailwind, declarative themes and the visual editor. Use when the user asks for plantillas premium, storefront architecture, art direction for Clásica/Selecta/Impulso, ecommerce design-system matrix, Tailwind storefront, CRO of catalog/PDP/cart/checkout, or to auditar/evolucionar tiendas virtuales. Complements vendedoria-ui; not for console/marketing polish, commerce-rule changes, or replacing the theme engine.
---

# VendedorIA — premium ecommerce storefront

Follow the master brief **verbatim**. Do not paraphrase, soften or drop its prohibitions.

1. Read [master-prompt.md](master-prompt.md) by heading for the current phase; never load the entire file for a local visual tweak.
2. Read `apps/store/AGENTS.md`, then only the packages the phase needs (`packages/themes`, `packages/design-tokens`, `packages/ui`, `packages/contracts`).
3. For buyer-funnel copy, checkout ethics and one-page payment behavior, also load `vendedoria-ui` → [commerce-conversion](../vendedoria-ui/commerce-conversion.md).
4. For console/marketing polish, use `vendedoria-ui` instead of this skill.
5. When continuing Selecta, read [selecta.md](references/selecta.md) for its established home/shop split, width policy and verification targets. Verify those paths against code before editing.

Code wins over this brief. Add one line to `docs/agent/context-map.md` → Discrepancies if docs and executable contracts disagree. Ask only when a choice irreversibly changes product behavior or cannot be expressed with current theme/editor contracts.

## Use when

- Auditing or evolving Classic / Selecta / Stride (Impulso) templates toward premium quality.
- Completing the ecommerce Design System Matrix for the storefront.
- Differentiating art direction without homogenizing themes.
- Improving shared commerce presentation (card, gallery, cart, checkout chrome) without changing money, stock or checkout rules.
- Integrating visual changes with `TEMPLATE_SECTIONS`, theme manifests, preview and the visual editor.

Not for: NestJS commerce logic, payments/webhooks, Prisma, console DSM work, or a greenfield store app.

## Authority order

1. Executable store, theme, token and contract code.
2. [master-prompt.md](master-prompt.md) (product/UX standard for this skill).
3. `docs/DESIGN-SYSTEM.md` store rows and `packages/design-tokens/storefront.scss`.
4. `apps/store/AGENTS.md`, `packages/AGENTS.md`, `docs/THEMES.md` (by heading).

Priority from the brief: **Brand Identity → Customer Experience → Visual Hierarchy → Conversion → Accessibility → Performance → Maintainability**.

Themes control presentation. Catalog, cart, checkout, payments, coupons, shipping, consent and SEO truth stay in the SaaS engine.

## Repository first (phase 1)

Inspect before any visual rewrite: `apps/store`, `packages/themes`, `packages/design-tokens`, `packages/ui`, real renderers and manifests, registered sections, editor/preview, catalog/cart/checkout contracts, SSR, current CSS, whether Tailwind is installed, existing tests, architectural limits.

Do not invent endpoints, editor fields, payment methods, reviews, discounts, badges or newsletter unless the code already supports them. Do not replace the theme engine.

Confirm live theme ids (do not assume): `vendedoria/classic`, `vendedoria/selecta`, `vendedoria/stride`.

## Phased work

Copy and track:

```
- [ ] 1 Audit architecture, tokens, Tailwind, templates
- [ ] 2 Ecommerce Design System Matrix (compatible with existing tokens)
- [ ] 3 Art direction per family (do not homogenize)
- [ ] 4 Shared commerce components (reuse before duplicate)
- [ ] 5 Storefront pages: home → catalog → product → cart → checkout → confirmation
- [ ] 6 Editor schemas, preview, draft/publish compatibility
- [ ] 7 Responsive and WCAG 2.2 AA
- [ ] 8 Performance and SEO (measure; do not invent vitals)
- [ ] 9 Builds and theme tests
- [ ] 10 Cleanup of duplicate/obsolete styles
```

Stay inside the user-named surface when the request is narrower than a full pass.

## Design implementation

For a template redesign, identify the visible composition changes before editing: hero, photography, typography, section rhythm, discovery and purchase hierarchy. Implement a coherent change on the requested pages; changing only colors, borders or a secondary cart detail does not satisfy a full-template redesign.

Inspect the rendered baseline when browser tooling is available, then verify the changed views on desktop and mobile. Distinguish visual inspection from DOM measurements and compilation. If screenshots or a running preview are unavailable, state that specific limitation; do not substitute build success for visual evidence.

Preserve the complete original brief in `master-prompt.md`. Keep subsequent template-specific decisions in linked references so they do not become requirements for unrelated templates.

## Hard contracts

- Tokens: platform vs theme vs merchant. Never paint tenant stores with VendedorIA corporate identity.
- Tailwind is the preferred layout tool once verified/integrated; no destructive migration; static class names; CSS variables for tenant-dynamic values; no concatenated tenant class names.
- Share primitives, a11y, contracts, commerce state and structural tokens. Differentiate art direction, type, rhythm, hero, grids and editorial composition.
- Search → reuse → compose → extend. Do not duplicate ProductCard per theme unless a variant cannot preserve identity.
- Angular 22: standalone, signals, OnPush, native control flow, SSR-safe browser APIs, typed `packages/contracts`.
- Guest checkout, real payment methods, integer-cent amounts, no invented scarcity/testimonials/certifications.
- Visual QA only when actually performed. Product-relevant changes: `CHANGELOG.md` → `[Unreleased]`.

## Verify

| Change | Run |
| --- | --- |
| store templates/styles | `npm run build:store` |
| themes/manifests/sections | `npm run theme:check` · `npm run theme:test` · `npm run theme:test:store` |
| store logic | `npm run test -w @vendedoria/store -- --watch=false` |
| shared UI/tokens | `npm run build:web` and `npm run build:store` |
| contracts | all three app builds |

Manual: `http://{slug}.localhost:4300` with the dev stack. Exercise home → catalog → product → cart → checkout. Check editor preview when sections/schemas change.

## Delivery

End with the brief’s report: diagnosis, visual direction, design system, implementation, UX/CRO, responsive/a11y, performance/SEO (measured only), validation commands, real limitations. No invented results.
