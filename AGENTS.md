# Agopify

Multi-tenant SaaS: AI sales agents on WhatsApp/Instagram ("del hola al pago") plus a public web store per tenant. Brownfield npm-workspaces monorepo, Node >= 22, Docker-first development.

## Authority
1. Executable code > tests > config/CI/Docker > the user's instructions for the task.
2. `PROJECT CONSTITUTION.md` is the product/UX authority (~750 lines). Never read it whole: open only the heading the task needs (routing table in `.agents/skills/agopify-implement/SKILL.md`).
3. Then this file, the nearest local `AGENTS.md`, then skills. Chat is never a source of truth.
4. Code vs docs conflict: follow verifiable code, add one line to `docs/agent/context-map.md` → Discrepancies; ask only if the choice irreversibly changes product behavior.

## Repository map
- Commerce Integration Core (external Magento/Woo/… → unified catalog): `INTEGRATION_CORE_ARCHITECTURE.md`, gap `docs/architecture/INTEGRATION_CORE_GAP_ANALYSIS.md`, code `apps/api/src/commerce-integrations/` (distinct from plan `integrations/`)
- `apps/api` NestJS 11 + Fastify + Prisma 6 + PostgreSQL (`/api/v1`, Swagger `/docs`) → `apps/api/AGENTS.md`
- `apps/web` Angular 22 console + marketing (prerendered SSR) → `apps/web/AGENTS.md`
- `apps/store` Angular 22 tenant store, SSR per request resolved by host → `apps/store/AGENTS.md`
- `packages/ui`, `packages/design-tokens`, `packages/contracts` → `packages/AGENTS.md`
- Domain → paths index: `docs/agent/context-map.md`

## Global invariants
- Code, identifiers, comments, DB, endpoints in English; user-visible copy in Spanish.
- Tenant isolation: tenant-owned data is always scoped by a `tenantId` taken from the authenticated user or the store host, never from client input.
- Money flow A (tenant pays SaaS plan) and flow B (buyer pays an order) stay separate in domain, API and copy. Amounts are integer cents.
- Never read, print or commit secrets (`.env*` except `*.example`, Meta tokens, payment credentials). Chats, phones and emails are PII: never log them.
- The sales agent never invents price, stock or shipping; an operator's manual message pauses the agent in that conversation.
- No naming, copy or UI copied from competitors.
- Minimal coherent change: no unrelated refactors, renames, mass formatting, new dependencies or speculative abstractions.

## Work routing
- Load the least context: task → nearest `AGENTS.md` → one skill → affected files → direct dependencies. Expand only when evidence is missing; no repo-wide exploration by default.
- Feature or bug fix: `.agents/skills/agopify-implement`
- AI Core / multi-model sales brain evolution (hybrid over sales-engine-v2): `.agents/skills/agopify-ai-core` (with personal `agopify-ai-sales-engine` for lock/memory/tool invariants)
- AI Core conversation training / understanding gaps (multinicho: ordinals, confirmations, pack vs unit, sold-out, continuity): `.agents/skills/agopify-ai-core-training`. Gate: `npm run train:ai-core` (curriculum `docs/agent/evals/ai-core-training.json`)
- Prisma schema, migrations, tenant-scoped queries, test DB: `agopify-data`
- Auth, webhooks, payments, Meta channel, public store endpoints: `agopify-security`
- Console/store UI, design system, UX states: `agopify-ui`. First consult `docs/DESIGN-SYSTEM.md` (DSM); apply `docs/UX-UI-MASTER-SYSTEM.md` §75. Search → reuse → compose → extend before adding shared UI. Brand tokens and component contracts belong in packages, not features.
- Premium tenant-store templates (art direction, ecommerce DS matrix, Tailwind storefront, catalog/PDP/cart/checkout presentation): `agopify-storefront-premium`. Complements `agopify-ui`; does not replace the theme engine or commerce rules.
- Visual store editor (Structure | Preview | Inspector, draft/publish, section schemas, preview bridge, AI copilot for texts/sections/pages/images): `agopify-store-editor`. Complements `agopify-ui` and `agopify-storefront-premium`; never a free-form page builder.
- S3/CloudFront media, SES email, AWS IAM, deliverability and Terraform (`infra/terraform/`): `agopify-aws`
- Reviewing a diff or PR: `agopify-review`
- Full release pass (cleanup + security + copy + prod config): `agopify-production-readiness`, which runs `agopify-dead-code-cleanup`, `agopify-security-audit` and `agopify-copy-audit` (each also usable alone)
- Docker/deploy: `docker-compose*.yml`, `Dockerfile`, `docker/nginx/`, `scripts/docker.mjs`, `scripts/deploy.sh`, `docs/DEPLOY.md`.

## Canonical commands (repo root)
- Dev Docker: see `README.md` → Desarrollo. Canonical: `npm run dev` (postgres + api + console + store). Optional: `dev:redis` / `dev:all`.
- `npm run test:docker` (api unit + e2e on isolated `agopify_test`; dev stack must be up)
- `npm run build:api` · `npm run build:web` · `npm run build:store`
- `npm run lint` (api eslint with `--fix` + web dev build; it rewrites files)
- `npm run prisma:generate`

## Verification
- Build every affected app and run the narrowest relevant test first. Run everything only for cross-surface, contract, config or build changes.
- CI (`.github/workflows/ci.yml`) runs Prisma generation, all three builds, theme validation/tests, store runtime tests and console tests. Run API unit/e2e locally in the isolated Docker test DB when touched.
- Product-relevant changes get an entry in `CHANGELOG.md` → `[Unreleased]`.

## Documentation
- Product/UX authority: `PROJECT CONSTITUTION.md` (read by section)
- Marketing landing brief (commercial craft): `docs/MARKETING-LANDING-BRIEF.md`
- Store integration plan (proposal; code wins): `docs/plan-tienda-web.md`
- Ports, setup: `README.md` · Production deploy (automatic and manual): `docs/DEPLOY.md`
- User onboarding and access (business signup, team invites, platform operators, permissions): `docs/USUARIOS.md` · AWS infrastructure with Terraform: `docs/TERRAFORM.md`
