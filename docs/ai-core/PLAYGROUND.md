# Playground (channel-faithful preview)

**Probar vendedor** uses the same `SalesAgentRuntimeService.generateReply` path as WhatsApp/Instagram.

| Behaviour | Playground | Live channel |
| --- | --- | --- |
| Prompt, personality, FAQs, catalog tools | Same | Same |
| Pause when agent is inactive | Same message / escalate | Same |
| Photos after “mándame foto” | Shown in the thread | Sent via Meta |
| Payment CTA | Button in UI (no URL in text) | WhatsApp payment button |
| Orders / payment links | Dry-run (`pg_order_*`, `playground.local`) | Real Pedidos + MP |
| Meta send | Never | Outbox delivery |
| Metrics / inbox | Isolated `PlaygroundSession` | Production conversations |

## Production test checklist

1. Activate the seller (not paused) and save.  
2. Open **Probar vendedor** for that agent.  
3. Script: saludo → producto → foto → precio → “lo quiero” → distrito → botón **Pagar pedido**.  
4. Confirm the reply text has **no** “simulado / prueba” wording (only the UI chrome says the order is a test).  
5. Confirm “Por qué respondió” shows catálogo / stock / envío from real data.  
6. Optional canary: set motor to Sombra on a test channel, compare shadow-recorded reply with playground.  
7. Only then flip that agent to AI Core for live traffic.

Rate limit: `agent-playground-send` 20/min per IP. Motor changes remain OWNER/ADMIN only.
