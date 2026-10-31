# Conversation Engine

Inbound durability, debounce, locks and turn outbox: `SalesGatewayService`.  
Per-agent routing: `ai-runtime-mode.ts` + `SalesAgent.aiRuntimeMode` (`legacy` / `shadow` / `ai_core`).  
Lanes: `processing-lanes.ts` (fast / standard / complex).  
Multi-question: `multi-question.ts` + prompt guide; validator rejects unanswered compound inquiries.  
Understanding: `conversation-understanding.ts`, `buyer-intents.ts`, `observeBuyer` / `resolveSalesReference` — see **`UNDERSTANDING.md`**.  
Details: `docs/AI-SALES-ENGINE.md` and `DEPENDENCY_MAP.md`.
