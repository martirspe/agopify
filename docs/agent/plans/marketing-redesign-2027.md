# Marketing redesign 2027 — plan

## Audit summary (Phase 1)

| Area | Finding |
| --- | --- |
| Stack | Angular 22 standalone, OnPush, signals; marketing SSR `RenderMode.Prerender` |
| Boundary | Public marketing = `apps/web/src/app/features/marketing/*` at `/`. Auth = `/auth/*`. Console = `/app/*`. Store app = `apps/store` (tenant host). Do not touch console/store/auth logic. |
| Current IA | Single landing: header → hero → manifesto → demo → product stories → store (pronto) → setup → integrations → pricing → FAQ → close → footer |
| Brand | `#C8F542`, ink `#0B0D12`, Satoshi display / Manrope UI, `--ds-marketing-*`. No separate CORE logo asset in repo — wordmark + lime dot. |
| Verified product | WhatsApp Business + Instagram Direct; AI sales agent (catalog-grounded); Mercado Pago payment links; console inbox + pause AI; plans Inicia/Crece/Escala/Lidera (PEN). |
| Not available / honest | Facebook Messenger not a sales channel. Blog/Guides/Help Center marketing pages do not exist. Storefront = early access / not official plan feature. No verified testimonials/logos/metrics. Magento/Shopify commerce integrations ≠ public marketing claims. |
| Authority conflict | Master prompt asks for store as live pillar + mega-nav Resources. **Code + MARKETING-LANDING-BRIEF + Constitution win:** Spanish, honest store status, no dead links, no invented capabilities. |

## Design direction (Phase 2)

**Positioning:** AI commerce platform — agents that sell + connected storefront (in progress), one ecosystem.

**Visual:** Intelligent Commerce Aesthetic on existing tokens — editorial dark marketing, lime as accent only, real UI compositions (chat demo + store preview), alternate dark/light-section rhythm within marketing ink, purposeful CSS motion + `prefers-reduced-motion`.

**IA (anchors only — no dead routes):**

- Nav: Producto · Cómo vende · Plataforma · Planes · Empezar gratis / Entrar
- Sections: Hero → Manifesto/positioning → Demo → AI Agents → Store (pronto) → Connected ecosystem → How it works → Benefits → Use cases → Integrations → Pricing → FAQ → Close → Footer
- Omit Blog/Guides/Help Center/About until routes exist
- Omit fake social proof; product demos carry credibility

**Copy language:** Production Spanish. Thesis “del hola al pago” retained; dual-pillar framing without claiming store is shipped.

**Components:** Reuse `ds-icon`, `ds-link`, `ds-button`, `ds-disclosure`. Stay inside `features/marketing`. Extend demo interactivity (prompt chips) without backend calls.

## File plan

| File | Change |
| --- | --- |
| `marketing-home.page.{html,scss,ts}` | Sticky nav polish, cinematic dual-composition hero, manifesto |
| `marketing-demo.*` | Prompt-chip interaction + stage polish |
| `marketing-features.*` | Pillars, AI, store, ecosystem, steps, benefits, use cases, integrations |
| `marketing-pricing.*` | Pricing/FAQ/close/footer editorial refresh |
| `marketing-content.ts` | FAQ expansions grounded in product; keep plan numbers |
| `marketing-seo.ts` | Title/description aligned to platform framing |
| `marketing-home.page.spec.ts` / demo spec | Update selectors/copy assertions |
| `docs/MARKETING-LANDING-BRIEF.md` | Sync section arc |
| `CHANGELOG.md` | Unreleased entry |

## Verification

`npm run build:web` · `npm run test -w @agopify/web` (marketing specs)

## Out of scope

Backend, auth flows, console modules, inventing integrations, new npm deps, Framer Motion.
