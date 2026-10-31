# Tool registry

Read tools (model-callable): `sales-tool-registry.service.ts` — `search_products`, `get_product`, `get_product_variants`, `check_inventory`, `get_price`, `calculate_shipping`, `get_commercial_policy`, `get_order_status`.

Write commerce (backend-owned): order + payment link + escalate via `SalesAgentToolsService` / `OrdersService` / `PaymentsService`.

DTOs reject unknown fields including `tenantId`.
