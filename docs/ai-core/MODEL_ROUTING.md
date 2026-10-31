# Model routing

## Contract

- Port: `AiModelProvider` (`generate`, `generateStructured`, capabilities, usage).  
- Router: `AiModelRouter` selects provider by task + `SALES_MODEL_PROVIDER` (+ optional fallback).  
- Runtime and search stay ignorant of vendor URLs except through adapters.

## Tasks (initial)

| Task | Default strategy |
| --- | --- |
| `sales_reply` | Primary chat model (`OPENAI_MODEL`) with tools when stateful |
| `structured_json` | Same provider with JSON response format |
| `embedding` | Still in `SalesSearchService` (OpenAI embeddings); future port |

## Env

- `SALES_MODEL_PROVIDER=openai` (default)  
- `SALES_MODEL_FALLBACK_PROVIDER` optional; unused until a second adapter is registered  
- Existing `OPENAI_API_KEY` / `OPENAI_MODEL` feed the OpenAI adapter  

## Reliability

Adapters apply timeout via `AbortSignal`. Runtime keeps deterministic fallback when generation returns null. Circuit breaker / cost ledger: planned once multi-provider traffic exists.

## Adding a provider

1. Implement `AiModelProvider` under `agent-runtime/models/`.  
2. Register in module + router map.  
3. Document env secrets in both `.env*.example`.  
4. Add unit tests with mocked HTTP; never commit keys.
