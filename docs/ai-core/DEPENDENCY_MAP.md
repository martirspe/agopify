# AI Core — dependency map

## Message flow (WhatsApp / Instagram)

```
Meta webhook (HMAC)
  → ChannelsController / WhatsAppManualService
  → ChannelsService.handleMetaWebhook | handleInstagramWebhook
  → ConversationsService.ingestInbound*
       · resolve Channel + tenant (backend)
       · Conversation + Message(inboundKey, enginePending)
       · if SALES_ENGINE_MODE in {sales-engine-v2, ai-core}:
            SalesGatewayService.buffered
         else:
            SalesAgentRuntimeService.generateReply → ChannelMessengerService (sync)
  → SalesGatewayService (≈500 ms poll)
       · debounce → SalesConversationLock (Redis NX + PG advisory)
       · SalesEngineTurn STARTED
       · SalesMemoryService + salesState
       · SalesAgentRuntimeService.generateReply
            · SalesToolRegistry (read) → SalesAgentToolsService / Knowledge / Prisma
            · SalesSearchService (Qdrant IDs → PG)
            · AiModelRouter → AiModelProvider (OpenAI adapter)
            · validateSalesResponse
            · OrdersService / PaymentsService (backend-owned writes)
       · READY + salesState CAS
       · deliver → ChannelMessengerService → Meta
       · SENT | UNKNOWN / human review
```

## Module dependency sketch

```
channels ──► conversations ──► sales-gateway ──► agent-runtime
                                    │                 │
                                    ├─ sales-lock     ├─ models/ (providers)
                                    ├─ sales-memory   ├─ sales-tool-registry
                                    └─ plan-limits    ├─ sales-agent-tools
                                                      ├─ sales-search ──► Qdrant + OpenAI embeddings
                                                      ├─ knowledge
                                                      └─ orders ──► payments
```

Redis client is shared via `conversion/conversion-infrastructure.service.ts` (no second ioredis for sales).

## Safe extension points

| Change | Touch | Avoid |
| --- | --- | --- |
| New LLM vendor | `agent-runtime/models/*` + env | Runtime commerce branches |
| New read tool | `sales-tool-registry` + tools service | Exposing writes to the model |
| Stronger understanding | `sales-state` / conversation-context | Parallel state tables |
| Rollout control | `SALES_ENGINE_MODE` (+ future agent field) | Global force-enable without eval |
| Ops / metrics | `sales-engine.controller` / ops service | Logging message bodies |

## Frontend touchpoints

- Seller config: `apps/web/src/app/features/seller/`
- Agents API: `apps/web/src/app/core/api/agents-api.service.ts`
- Engine ops: console JWT → `/api/v1/agent-engine/*`
