# Selecta — established presentation and navigation

Read this when evolving Selecta in this repository. These are the user's accepted choices for Selecta, not requirements for Classic or Stride. Later user requests can change them; verify current implementation before relying on a path or limit.

## Experience

- Home is an editorial storefront introduction: brand hero, category discovery, a short product selection, editorial content and useful purchase information. Do not turn it into the complete searchable catalog.
- The current home selection is bounded to three products, with up to six category links. It uses the existing loaded catalog order; do not claim manual curation or best-seller status without supporting data.
- `/tienda` is the complete Selecta shop: category hierarchy, search, available facets, price filters, sorting, grid/list and pagination reuse `features/catalog` and its server-backed contracts.
- `/productos` and `/catalogo` are compatibility redirects to `/tienda`, preserving query parameters. Product detail remains `/producto/:handle`; cart, checkout and receipt URLs stay intact.
- Merchant navigation labels and explicit hides remain authoritative. Existing merchant links to `/productos` can map to `/tienda` in Selecta without changing other renderers.

## Width and art direction

Read `docs/SELECTA-DESIGN-SYSTEM.md` before styling Selecta. Identity tokens belong in `packages/design-tokens/selecta.scss`; shared component roles belong in `_selecta-system.scss`. Keep `_selecta-layout.scss` and `_selecta-editorial.scss` for composition. Extend a common role before adding route-specific visual exceptions; compare the same product in home and shop when changing cards.

- Selecta's beauty identity is editorial, refined and image-led. Preserve merchant colors, typography settings, copy and imagery.
- Hero and editorial campaign span the screen. Header/footer backgrounds span the screen while their content aligns to the shop container.
- Default catalog/content cap: 1440 px. Product detail cap: 1280 px. Cart/checkout cap: 1200 px. Respect a narrower merchant-selected container; avoid stretching commerce content indefinitely on large screens.
- Mobile imagery can span the screen, with readable content gutters from existing tokens. Adapt the hero composition rather than shrinking desktop artwork.
- Prefer `packages/design-tokens/storefront.scss`, existing shared components and static Tailwind utilities. Existing Selecta compositions live in `_selecta-layout.scss` and `_selecta-editorial.scss`, included by `selecta.scss`. Extend their existing owners instead of accumulating competing overrides.

## Focused code map

- `apps/store/src/app/templates/selecta/`: shell, home, product, cart, checkout, routes, copy and styles.
- `apps/store/src/app/features/catalog/`: shared full shop and query-state behavior.
- `apps/store/src/app/core/template-demo.interceptor.ts`: demo HTTP interception; use `request.urlWithParams` so fixtures receive category/search/sort/page parameters.
- `apps/store/src/app/demos/template-demo-data.ts`: isolated fixture data and filtering; never fall through to tenant APIs for a demo.
- `docs/DESIGN-SYSTEM.md`: current storefront composition and width contracts.

## Verification that matters

- Build the store; also build web when shared tokens/UI change. Run existing theme runtime and relevant store tests.
- In home, verify the bounded selection and that full catalog filters are absent. Follow a category link into `/tienda` and verify the returned products, not only the URL or active heading.
- Exercise shop search, category, price/sort, reset and pagination with data sufficient to show their effects. Verify old URLs preserve parameters and Selecta's canonical points to `/tienda`.
- Check desktop, tablet and narrow mobile for full-width hero/campaign, capped commerce containers, long copy and horizontal overflow. Restore temporary browser viewport overrides afterward.
- Preserve editor section order, hidden sections, custom text/image values and explicit empty values. Do not add schema fields just to implement presentation.
- Use isolated demos or test data for purchase checks; do not place real orders or submit payments as visual QA.

Report what changed visually, which interactions were actually checked, build/test results and concrete limitations. Keep measured performance separate from design expectations.
