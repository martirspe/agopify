# AI Core security

- Tenant from JWT or channel/host resolution only.  
- Tool args cannot set `tenantId`.  
- Qdrant/Redis keys include tenant; IDs rehydrated and revalidated in PostgreSQL.  
- Customer memory: `SalesCustomerMemory` PK `(tenantId, customerKey)`; `customerKey` is a SHA-256 of backend channel/thread (never client input); only durable customer-scoped facts persist; price/stock/payment never stored; expired rows ignored on load.  
- Destination memory requires an unambiguous ubigeo match (no guessing among same-name districts).  
- Chat L2 orders: server computes `order_draft_hash` (no PII); stores `Order.checkoutKey=chat:{tenantId}:{conversationId}:{hash}` + `requestHash`; retries/races replay the same row; tenantId on the order must match the caller.  
- No chat/PII in logs or traces.  
- Prompt injection: catalog/FAQ/buyer text is data, not instructions; override/discount attacks are refused and logged (`prompt_injection_blocked`).  
- Cross-tenant tool lookups deny with opaque not-found and `cross_tenant_denied` security events (no PII).  
- Webhook HMAC on Meta channels.  
- Rollback to `legacy` without deleting memory tables.
- Migration status is tenant JWT only; aggregates modes/pending turns/shadow counts — never chat text or phones.
- Per-agent mode changes require OWNER/ADMIN (`assertManager`) and are audited (`ai_runtime_mode_changed`); console cannot flip global `SALES_ENGINE_MODE`.
- Shadow never sends to Meta and runs commerce dry-run; canary (`ai_core`) is per agent only.
- Shadow delivery strips any live `orderId` / payment URL from metadata (`shadow_live_artifact_blocked`) even if a tool bug returned them.
- Playground send is rate-limited (`agent-playground-send`, 20/min per IP) to bound LLM cost abuse.

Use `agopify-security` when changing webhooks, payments or public store routes.
