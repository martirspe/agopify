# Phase 0 / post-increment baseline

**Recorded:** 2026-10-30 (local Docker dev stack up: api, postgres, redis, qdrant, store).

## Commands executed after AI Core foundation increment

| Command | Result |
| --- | --- |
| `docker compose -f docker-compose.dev.yml exec -T api npx jest agent-runtime --runInBand` | **PASS** — 10 suites, 123 tests |
| `npm run build:api` | **PASS** |

## Pre-existing notes (not introduced by this work)

- Full `npm run test:docker` and `eval:sales` were not re-run in this session; last documented green full suite was 2026-10-05 in `docs/AI-SALES-ENGINE.md` (328 unit + 94 e2e). Re-run before production canary if persistence or gateway contracts change.
- Console/store bundle budget warnings may appear on web/store builds; unrelated to agent-runtime.
- Facebook Messenger channel and inbound media remain unimplemented (product scope).

## Environment observed

- `SALES_ENGINE_MODE` default remains durable path (`sales-engine-v2`; alias `ai-core` accepted).
- OpenAI key optional; deterministic fallback covered by unit tests.
