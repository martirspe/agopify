# Operations

Env: `SALES_*`, `OPENAI_*`, `REDIS_URL`, `QDRANT_URL` — see `.env.example` and `docs/AI-SALES-ENGINE.md` → Operación.

Endpoints (JWT tenant): `/api/v1/agent-engine/backfill`, `.../conversations/:id`, `.../metrics`, `GET /api/v1/agents/:id/analytics`.

## Sales engine

- Product path is AI Core (`SalesAgent.aiRuntimeMode` defaults to `ai_core`). The console does not switch motors.
- Global `SALES_ENGINE_MODE` is ops-only (restart API after change). Default: `sales-engine-v2`.
- API may still set `aiRuntimeMode` for emergency/tests (OWNER/ADMIN); emits `ai_runtime_mode_changed` (from→to:risk:role, no PII).
- Before env → `legacy`: drain durable turns (`STARTED` / `READY` / `SENDING`).
- Playground send: bucket `agent-playground-send` (20/min per IP).
- Channel-faithful playground: [`PLAYGROUND.md`](./PLAYGROUND.md).
- Status playbook: [`MIGRATION.md`](./MIGRATION.md).

## Health

Prefer fixing forward on AI Core. Do not delete memory or turn tables on rollback.
