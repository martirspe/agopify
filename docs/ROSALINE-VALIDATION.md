# Rosaline — verification

Date: 2026-10-20 (America/Lima). Source: home-bold-modern.html. Release vendedoria/rosaline@1.0.0.

## Current source-based implementation

- Store production/SSR build passes. Initial bundle 418.02 kB exceeds the 400 kB warning budget; error budget is 800 kB. Rosaline CSS is lazy-loaded separately (~928 kB raw, ~81 kB estimated transfer) because it preserves the source stylesheets.
- theme:check: seven valid releases.
- theme:test: 13 passed, including renderer independence and editor sanitizer compatibility.
- theme:test:store: six passed.
- Angular store/Vitest: six passed across three suites.

Earlier integration verification also passed API and web builds. Docker API unit tests passed 368/368 across 54 suites. E2e passed 122/124: two failures in sales-engine.e2e-spec.ts concern Qdrant tenant filtering and approved FAQ refresh. The complete e2e run is not passing.

## Browser evidence

The original mirror and compiled SSR demo were opened side by side. At actual CSS width 390px, both hero sections measure 600.03px high. At width 1361px, both measured 911.19px. At 1440px, the final hero measures 925.32px versus 925.33px in the original; the vertical thumbnail gallery matches the original height of 668.77px. The original button background is rgb(234,236,161), and the migrated button matches. Both use Anton for the display title and the original hero photograph. Screenshot capture became available during this continuation; the mobile comparison was visually inspected.

Verified interactions: opening the original cart drawer without navigation, adding the reference serum, increasing quantity from one to two, subtotal changing from S/32 to S/64, closing the drawer, advancing to detail-1_2.jpg, opening the mobile menu and its full-screen search with real suggestions. The five-image gallery uses the original reference assets. Search suggestions use the existing product API. The quick-view modal adds the selected product and opens the original cart drawer; the mobile footer accordion expands correctly. No horizontal overflow was measured at actual widths 320, 390, 768, 1024, 1440 and 1920px.

A small mobile overflow came from the image-comparison handle at its original 99% starting position. The source plugin's icv clipping container was restored. The skip link is hidden until keyboard focus. Responsive carousel columns/gaps now follow source data attributes, and the source three video files are local.

## Limits

Hero geometry and interaction checks do not establish complete pixel parity. Full-page paired screenshots, all responsive breakpoints, source animation parity, accessibility certification and Core Web Vitals remain unverified. The editor draft/publish/history round trip and a real authorized tenant purchase were not performed. Product/cart/checkout/legal routes reuse current domain views rather than additional vendor pages. Unsupported platform capabilities and license status are documented in ROSALINE-DESIGN-SYSTEM.md.

## Console enablement (1.1.0)

Rosaline is selectable for every industry through the existing console theme gallery. Saving keeps the selected template in the normal draft flow; no tenant was automatically changed or published. Eight sealed releases validate successfully. Fourteen theme tests, six store runtime tests, seven console store-setting tests and eighteen API template tests pass. The API container reports Rosaline 1.1.0 with industries=all. API, console and store builds pass. The design, assets, tokens, sections and presets match 1.0.0; migration preserves existing content.

Browser confirmation: after clearing the Angular development cache and restarting web/store, the console library shows the Rosaline card, a loaded cover image and an enabled selection button. The current tenant remained on Selecta; no store design was automatically changed or published.
