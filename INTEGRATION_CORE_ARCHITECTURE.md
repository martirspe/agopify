# INTEGRATION_CORE_ARCHITECTURE.md

**Proyecto:** VendedorIA  
**Documento:** Arquitectura oficial del núcleo universal de integraciones  
**Versión:** 1.0.0  
**Estado:** Proposed — Pending Implementation  
**Prioridad:** Estratégica  
**Ámbito:** Backend, Frontend, Data Architecture, Integrations, AI Commerce  
**Objetivo:** Construir una infraestructura universal, extensible y multi-tenant para conectar plataformas externas de comercio electrónico con VendedorIA.

**Prioridad de adaptadores (decisión de producto):** Magento 2 / Adobe Commerce y WooCommerce son las primeras implementaciones de referencia. Otras plataformas quedan registradas y mapeadas en el registry; su adaptador completo es un hito posterior.

---

# 1. VISIÓN Y OBJETIVO

VendedorIA debe evolucionar hacia una plataforma AI-first de comercio conversacional que permita conectar diferentes plataformas de comercio electrónico y centralizar su información comercial.

El objetivo es que cada negocio pueda conectar una o varias tiendas externas, sincronizar sus catálogos y utilizar sus productos mediante agentes vendedores de IA en los distintos canales de comunicación.

La integración de una plataforma nueva no debe requerir modificar la lógica central de los agentes vendedores ni crear un catálogo paralelo.

## 1.1 Principio arquitectónico

**One Integration Core. Multiple Commerce Platforms. One Unified Catalog. Multiple AI Sales Channels.**

La arquitectura debe garantizar:

- Independencia entre plataformas.
- Reutilización de servicios.
- Normalización de datos.
- Sincronización confiable.
- Aislamiento multi-tenant.
- Seguridad de credenciales.
- Escalabilidad horizontal.
- Observabilidad.
- Compatibilidad con el sistema actual de agentes IA.

## 1.2 Objetivos de negocio

1. Facilitar la conexión de tiendas externas.
2. Eliminar la carga manual de catálogos.
3. Mantener actualizados productos, precios e inventarios.
4. Permitir que los agentes IA consulten cualquier catálogo conectado.
5. Reducir el tiempo de incorporación de nuevos comercios.
6. Preparar VendedorIA para convertirse en una plataforma de integración comercial multicanal.

## 1.3 Capas objetivo

```
EXTERNAL COMMERCE PLATFORMS
  Magento · WooCommerce · otras plataformas mapeadas · futuras

INTEGRATION CORE
  Connection Manager · Authentication Manager · Platform Adapters
  Webhook Gateway · Sync Engine · Job Orchestrator
  Product Normalizer · Integration Monitor

UNIFIED COMMERCE DATA
  Products · Variants · Inventory · Prices · Categories · Media
  (catálogo central existente: Product / ProductVariant / …)

AI COMMERCE LAYER
  Catalog Search · Product Context · Availability · Recommendations
  (sales-agent-tools + catalog-search + Qdrant; sin catálogo paralelo)

VENDEDORIA AI SALES AGENTS
  WhatsApp · Instagram · Facebook · Messenger · Otros canales
```

---

# 2. PRINCIPIOS FUNDAMENTALES

## 2.1 Single Source of Truth

Cada plataforma externa conserva la autoridad sobre los datos que administra.

VendedorIA mantiene una representación normalizada de esos datos para utilizarlos en su propio ecosistema.

No modificar el catálogo externo desde los procesos de sincronización de lectura.

## 2.2 Unified Product Catalog

Todos los productos deben converger en el catálogo central existente (`Product`, `ProductVariant`, `ProductMedia`, …).

No crear entidades comerciales independientes por plataforma (`MagentoProducts`, `WooProducts`, …).

Las diferencias de cada plataforma se resuelven mediante adaptadores y metadatos de origen (`ProductSource` / `CommerceIntegrationResource`).

## 2.3 Adapter Pattern

Cada plataforma implementará un adaptador independiente que cumpla un contrato común.

El Integration Core no debe contener lógica específica de Magento, WooCommerce u otra plataforma.

## 2.4 Event-Driven Architecture

Los cambios externos deben procesarse mediante eventos cuando la plataforma los proporcione.

El sistema también debe disponer de mecanismos de polling y reconciliación.

## 2.5 Asynchronous Processing

Las importaciones y sincronizaciones deben ejecutarse mediante workers y colas (Redis / BullMQ existente).

Nunca realizar una importación completa dentro de una solicitud HTTP síncrona.

## 2.6 Tenant Isolation

Toda operación debe estar asociada al tenant correspondiente.

Una integración nunca debe acceder a productos, credenciales, ejecuciones o eventos de otro tenant.

El `tenantId` proviene del usuario autenticado (o del contexto de webhook firmado), nunca de input de cliente sin verificar.

## 2.7 Backward Compatibility

La incorporación del Integration Core no debe romper:

- Catálogo manual.
- Productos existentes.
- Agentes vendedores.
- Configuración de agentes.
- Canales conectados.
- Sistema de conversaciones.
- Memoria conversacional.
- Funcionalidades existentes de VendedorIA.
- El módulo de plan `integrations` (`TenantIntegration`: store, custom_domain, tracking, …).

## 2.8 Naming en este repositorio

El módulo Nest/API actual `apps/api/src/integrations/` administra **features de plan** (tienda web, dominio, tracking, Instagram, team, TikTok LIVE), no conectores de ecommerce.

El Integration Core de comercio externo vive en un módulo distinto (p. ej. `commerce-integrations`) y rutas bajo `/api/v1/commerce-integrations`, para no colisionar con el contrato existente ni con la consola de activación de plan.

---

# 3. COMPONENTES DEL SISTEMA

## 3.1 Integration Core

Responsable de administrar el ciclo de vida de las integraciones comerciales externas.

Responsabilidades:

- Registrar integraciones.
- Administrar conexiones.
- Resolver adaptadores.
- Validar permisos.
- Gestionar credenciales.
- Administrar configuraciones.
- Desconectar plataformas.
- Consultar estado de conexiones.
- Controlar aislamiento multi-tenant.

## 3.2 Platform Adapter Registry

Registro central de adaptadores disponibles.

Cada adaptador debe declarar:

- Platform ID.
- Nombre.
- Versión.
- Métodos de autenticación.
- Recursos soportados.
- Capacidades.
- Tipos de sincronización.
- Compatibilidad.
- Configuraciones requeridas.

| Adaptador   | API principal     | Sincronización               | Prioridad de implementación |
| ----------- | ----------------- | ---------------------------- | --------------------------- |
| Magento     | REST API          | Polling + eventos opcionales | **Primera (referencia)**    |
| WooCommerce | REST API          | Webhooks + polling           | **Primera (referencia)**    |
| Otras (mapeadas) | Según plataforma | Webhooks / sync | Mapeado / posterior |
| PrestaShop  | Webservice API    | Polling                      | Mapeado / posterior         |

El registro debe permitir agregar nuevos adaptadores sin modificar los servicios centrales.

## 3.3 Authentication Manager

Debe soportar OAuth 2.0, OAuth 1.0a, API Tokens, API Keys y credenciales específicas.

El adaptador declara el método correspondiente.

Credenciales cifradas en reposo (AES-256-GCM, patrón `credentials-cipher`); clave fuera de la base de datos; sin secretos en logs ni en respuestas al frontend.

## 3.4 Sync Engine

Motor universal de sincronización: importación inicial, incremental, eventos, reconciliación, checkpoints, reintentos e idempotencia.

## 3.5 Webhook Gateway

Punto de entrada centralizado para eventos externos.

Validar firma (por proveedor), persistir, deduplicar, encolar; responder rápido. Sin trabajo pesado en el request HTTP.

## 3.6 Product Normalizer

Transforma modelos externos al esquema canónico y luego al `Product` interno (centavos enteros, handles únicos por tenant, variantes, media).

Conservar metadatos de origen relevantes.

## 3.7 Integration Monitor

Observabilidad: estado de conexión, última/próxima sync, duración, ítems procesados, errores, reintentos, eventos, workers.

---

# 4. CONTRATO UNIVERSAL DE ADAPTADORES

Todos los adaptadores deben implementar una interfaz común (TypeScript en `apps/api`).

Referencia arquitectónica:

```typescript
interface CommercePlatformAdapter {
  readonly platform: CommercePlatform;
  readonly capabilities: PlatformCapabilities;

  validateConnection(
    credentials: IntegrationCredentials,
  ): Promise<ConnectionValidationResult>;

  getStoreInformation(
    context: IntegrationContext,
  ): Promise<ExternalStore>;

  fetchProducts(
    context: IntegrationContext,
    options: ProductFetchOptions,
  ): Promise<PaginatedResult<ExternalProduct>>;

  fetchProductById(
    context: IntegrationContext,
    externalId: string,
  ): Promise<ExternalProduct | null>;

  fetchCategories(
    context: IntegrationContext,
    options?: PaginationOptions,
  ): Promise<ExternalCategory[]>;

  fetchInventory(
    context: IntegrationContext,
    options?: PaginationOptions,
  ): Promise<ExternalInventory[]>;

  fetchProductChanges?(
    context: IntegrationContext,
    checkpoint: SyncCheckpoint,
  ): Promise<ChangeFeedResult>;

  subscribeToEvents?(
    context: IntegrationContext,
    callbackUrl: string,
  ): Promise<WebhookSubscriptionResult>;

  unsubscribeFromEvents?(
    context: IntegrationContext,
  ): Promise<void>;

  normalizeProduct(
    product: ExternalProduct,
  ): NormalizedProduct;

  disconnect(
    context: IntegrationContext,
  ): Promise<void>;
}
```

Si una plataforma no soporta una capacidad, se declara explícitamente. No implementar métodos vacíos que aparenten funcionalidades inexistentes.

## 4.1 PlatformCapabilities

Declarativas, entre otras:

- `products.read`
- `products.bulk_read`
- `products.incremental_sync`
- `products.webhooks`
- `products.variants`
- `products.media`
- `products.categories`
- `inventory.read`
- `inventory.multi_location`
- `pricing.read`
- `metafields.read`
- `store.multiple_views`

La disponibilidad depende de plataforma, versión, permisos y configuración de la tienda.

---

# 5. MODELO UNIVERSAL DE PRODUCTOS

## 5.1 NormalizedProduct

Modelo conceptual intermedio (antes de persistir en `Product`):

```typescript
interface NormalizedProduct {
  id?: string;
  tenantId: string;
  title: string;
  slug?: string;
  description?: string;
  shortDescription?: string;
  sku?: string;
  barcode?: string;
  productType?: string;
  vendor?: string;
  brand?: string;
  status: ProductStatus;
  visibility?: string;
  currency?: string;
  /** Integer cents — same invariant as the rest of VendedorIA. */
  priceCents?: number;
  compareAtPriceCents?: number;
  costPriceCents?: number;
  weight?: number;
  weightUnit?: string;
  categories: NormalizedCategory[];
  images: NormalizedMedia[];
  variants: NormalizedVariant[];
  inventory?: NormalizedInventory[];
  attributes: Record<string, unknown>;
  source: ProductSource;
  createdAt?: string;
  updatedAt?: string;
}
```

## 5.2 ProductSource

```typescript
interface ProductSource {
  integrationId: string;
  platform: string;
  externalProductId: string;
  externalSku?: string;
  externalUrl?: string;
  externalUpdatedAt?: string;
  lastSyncedAt?: string;
}
```

Identidad: `(tenantId, integrationId, externalProductId)` — y variant id cuando aplique. No asumir que el SKU es único globalmente.

## 5.3–5.5 Variants, Inventory, Media

Ver modelos `NormalizedVariant`, `NormalizedInventory`, `NormalizedMedia` en el diseño de implementación. Inventario: no asumir semántica idéntica entre plataformas. Dinero siempre en centavos enteros.

---

# 6. MODELO DE DATOS DEL INTEGRATION CORE

Antes de crear tablas, reutilizar entidades compatibles. Responsabilidades lógicas:

| Entidad lógica            | Rol                                      |
| ------------------------- | ---------------------------------------- |
| CommerceIntegration       | Conexión externa por tenant              |
| CommerceIntegrationResource | Mapeo externalId ↔ internalId          |
| CommerceSyncExecution     | Ejecución de sync (métricas + checkpoint)|
| CommerceSyncExecutionItem | Auditoría por ítem (retención limitada)  |
| CommerceWebhookEvent      | Eventos entrantes idempotentes           |
| Sync settings             | JSON en la integración o tabla dedicada  |

Índices y `@@unique` por tenant + integration + external id. Productos manuales no llevan resource mapping.

---

# 7. MOTOR UNIVERSAL DE SINCRONIZACIÓN

Flujos: **Initial Sync**, **Incremental Sync**, **Event Sync**, **Reconciliation**.

Idempotencia: unique constraints, idempotency keys, locks distribuidos, upserts, dedupe de eventos, checkpoints transaccionales.

Preferir re-fetch del recurso en la plataforma cuando el webhook no traiga payload completo.

---

# 8. JOB ORCHESTRATOR Y COLAS

Reutilizar Redis + BullMQ (mismo patrón que `conversion/`). No añadir otro broker sin justificación.

Jobs (nombres adaptables): initial sync, incremental, webhook process, product import batch, inventory sync, image process, reconciliation, credential refresh.

Resiliencia: backoff exponencial, reintentos limitados, DLQ/retain fails, timeouts, locks, concurrencia configurable, rate limits.

Prioridad sugerida: inventario → precios → productos nuevos → catálogo → media → reconciliación completa.

---

# 9. SEGURIDAD

- Credenciales: cifrado autenticado, clave fuera de DB, redacción en logs, rotación/revocación, nunca al frontend.
- SSRF: HTTPS, DNS, IP privada/loopback/link-local/metadata, rebinding — crítico en Magento/Woo self-hosted.
- Webhooks: firma, timestamp, replay, dedupe, size limits, rate limit.
- Multi-tenancy: `tenantId` del JWT / ownership de la integración.

---

# 10. AI COMMERCE LAYER

El Integration Core alimenta el catálogo central. Los agentes (`sales-agent-tools`) **no** consultan APIs de plataforma por producto.

PostgreSQL = verdad de precio/stock. Qdrant = semántica. Redis = caché/ops. El LLM no inventa precio ni disponibilidad.

Freshness: evaluar antigüedad; refresh puntual a la plataforma solo si capability + política lo permiten; no afirmar “tiempo real” sin validar.

---

# 11. API DEL INTEGRATION CORE

Convenciones Nest actuales (`/api/v1`, Swagger `/docs`). Rutas conceptuales bajo **`/commerce-integrations`** (evitar colisión con plan integrations):

- `GET /commerce-integrations`
- `GET /commerce-integrations/platforms`
- `GET /commerce-integrations/:id`
- `POST /commerce-integrations/:platform/connect`
- `POST /commerce-integrations/:id/test`
- `PATCH /commerce-integrations/:id`
- `DELETE /commerce-integrations/:id`
- `POST /commerce-integrations/:id/sync`
- `GET /commerce-integrations/:id/sync/status`
- `GET /commerce-integrations/:id/sync/history`
- `POST /webhooks/commerce/:platform/:integrationId`

---

# 12. UX/UI Y ADMINISTRACIÓN

Consola central alineada al Design System. Marketplace con categorías E-commerce / Marketplaces / Social / ERP / CRM.

Detalle: Overview, Connection, Synchronization, Catalog, Settings, Activity, Logs.

Estados: Available, Connecting, Connected, Syncing, Error, Reauthorization required, Disconnected.

Datos reales de sync; sin estadísticas simuladas.

---

# 13. ROADMAP DE IMPLEMENTACIÓN

| Fase | Contenido | Prioridad |
| ---- | --------- | --------- |
| 0 | Auditoría + gap analysis | Hecho / continuo |
| 1 | Integration Core (registry, conexiones, credenciales, contratos, API) | **Ahora** |
| 2 | Unified Catalog + Sync Engine | Siguiente |
| 3 | **Magento adapter** (referencia) | **Ahora / junto al core** |
| 4 | **WooCommerce adapter** (referencia) | **Ahora / junto al core** |
| 5 | Adaptadores mapeados adicionales (completos) | Mapeado |
| 6 | PrestaShop adapter | Mapeado |
| 7 | AI Commerce freshness / hardening | Después |
| 8 | Observabilidad y hardening | Después |

Metodología: **INSPECT → UNDERSTAND → MEASURE → DESIGN → IMPLEMENT → VALIDATE → DOCUMENT.**

---

# 14. PRINCIPIOS DE IMPLEMENTACIÓN Y GOBERNANZA

- No arquitectura teórica desconectada del repo.
- No abstracciones innecesarias.
- No forzar capacidades que el proveedor no tiene.
- No reemplazar funcionalidades sin regresión.
- No modificar agentes IA más de lo necesario para el catálogo unificado.
- Toda modificación con justificación técnica.

---

# 15. CRITERIOS DE ACEPTACIÓN

1. Registro de adaptadores funcional.
2. Múltiples plataformas registrables.
3. Credenciales protegidas.
4. Conexiones multi-tenant.
5. Contrato universal.
6. Modelo normalizado de productos.
7. Importación inicial ejecutable.
8. Actualizaciones incrementales (cuando la plataforma lo permita).
9. Procesamiento asíncrono.
10. Idempotencia.
11. Reconciliación.
12. Webhooks protegidos.
13. Historial consultable.
14. Administración de conexiones.
15. Agentes sobre catálogo común.
16. Vigencia de inventario/precio respetada.
17. Integraciones/plan anteriores intactas.
18. Pruebas automatizadas.

---

# 16. DECISIÓN ARQUITECTÓNICA FINAL

VendedorIA adopta:

- Adapter Pattern · Registry Pattern · Strategy (auth)
- Event-Driven + Queue-Based Processing
- Canonical Data Model sobre el catálogo existente
- Multi-tenant isolation · Idempotent synchronization

Implementación incremental; sin reescritura general.

**El Integration Core es la infraestructura oficial para todas las integraciones comerciales presentes y futuras de VendedorIA.**

Documento de análisis vs código: `docs/architecture/INTEGRATION_CORE_GAP_ANALYSIS.md`.
