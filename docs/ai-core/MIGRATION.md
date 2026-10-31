# Sales engine status

**AI Core (durable `sales-engine-v2`) is the only product sales path.** Progressive shadow → canary → expand rollout was retired before production customers.

## Defaults

| Knob | Value |
| --- | --- |
| `SALES_ENGINE_MODE` | `sales-engine-v2` (alias `ai-core`) |
| `SalesAgent.aiRuntimeMode` | `ai_core` (new agents and schema default) |

Playground uses the same `generateReply` path with commerce dry-run (no Meta send, no live orders). See [`PLAYGROUND.md`](./PLAYGROUND.md).

## Ops-only overrides

The API still accepts `aiRuntimeMode` (`inherit` \| `ai_core` \| `shadow` \| `legacy`) for emergency/tests. The console does **not** expose motor switching or a migration dashboard.

| Value | Behaviour |
| --- | --- |
| `ai_core` | Durable inbox + live channel send (default) |
| `inherit` | Follow `SALES_ENGINE_MODE` |
| `shadow` | Durable process; never Meta send; commerce dry-run |
| `legacy` | Sync path (ops rollback only) |

Mode changes require OWNER/ADMIN and audit as `ai_runtime_mode_changed` (no PII).

## Env rollback (ops)

1. Drain pending durable turns (`SalesEngineTurn` in `STARTED` / `READY` / `SENDING`).
2. Set `SALES_ENGINE_MODE=legacy` and restart the API only if explicitly required.
3. Do not delete `SalesEngineTurn`, `SalesCustomerMemory`, or `Conversation.salesState`.
4. Do not re-send messages already marked `SENT` by the durable gateway.

Prefer fixing forward on AI Core over env rollback.
