# Resilience & security (Stage 5)

## Scenario K — tenant isolation

Read tools (`get_order_status`, product lookups) always filter by authenticated `tenantId`. A foreign id yields the same opaque `*_NOT_FOUND` to the model and records `ai_core_security` with `cross_tenant_denied` (no PII in logs).

## Scenario L — provider failure

`AiModelRouter.generate`:

1. Tries the primary provider once.
2. Falls back at most once to `SALES_MODEL_FALLBACK_PROVIDER` when capabilities match the request.
3. Otherwise returns `null` → runtime uses deterministic fallback once (no duplicate Meta send / no second LLM call).

`degraded: true` marks fallback replies.

## Scenario M — prompt injection

`detectPromptInjection` flags override / secret-dump / arbitrary-discount attempts. Runtime refuses with a fixed Spanish reply, logs `prompt_injection_blocked`, and never opens commerce tools for that turn. Validator rejects unauthorized `% descuento` claims without a published FAQ fact.

## Playground

Isolated state; errors in `generateReply` still persist a safe agent message so the composer never sticks mid-send.
