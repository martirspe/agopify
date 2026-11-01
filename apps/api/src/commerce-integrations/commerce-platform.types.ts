/** Capability flags declared by each commerce platform adapter. */
export type PlatformCapability =
  | 'products.read'
  | 'products.bulk_read'
  | 'products.incremental_sync'
  | 'products.webhooks'
  | 'products.variants'
  | 'products.media'
  | 'products.categories'
  | 'inventory.read'
  | 'inventory.multi_location'
  | 'pricing.read'
  | 'metafields.read'
  | 'store.multiple_views';

export type CommercePlatformId =
  | 'magento'
  | 'woocommerce'
  | 'shopify'
  | 'prestashop';

export type IntegrationCredentials = Record<string, string>;

export type IntegrationContext = {
  tenantId: string;
  integrationId: string;
  baseUrl: string | null;
  credentials: IntegrationCredentials;
  configuration: Record<string, unknown>;
};

export type ConnectionValidationResult = {
  ok: boolean;
  storeName?: string;
  storeId?: string;
  message?: string;
  capabilities?: PlatformCapability[];
};

export type ExternalStore = {
  id: string;
  name: string;
  currency?: string;
  url?: string;
};

export type PaginatedResult<T> = {
  items: T[];
  nextCursor?: string | null;
  hasMore: boolean;
};

export type ProductFetchOptions = {
  cursor?: string | null;
  pageSize?: number;
  updatedSince?: string | null;
};

export type PaginationOptions = {
  cursor?: string | null;
  pageSize?: number;
};

export type SyncCheckpoint = {
  cursor?: string | null;
  updatedSince?: string | null;
  page?: number;
};

export type ChangeFeedResult = {
  items: ExternalProduct[];
  checkpoint: SyncCheckpoint;
  hasMore: boolean;
};

export type WebhookSubscriptionResult = {
  subscribed: boolean;
  topics: string[];
};

export type ExternalCategory = {
  id: string;
  name: string;
  parentId?: string | null;
};

export type ExternalInventory = {
  productId?: string;
  variantId?: string;
  locationId?: string;
  quantity?: number;
  availableQuantity?: number;
  isAvailable: boolean;
};

export type ExternalProduct = {
  id: string;
  title: string;
  slug?: string;
  description?: string;
  shortDescription?: string;
  sku?: string;
  status?: string;
  currency?: string;
  priceCents?: number;
  compareAtPriceCents?: number;
  brand?: string;
  categories?: ExternalCategory[];
  images?: Array<{
    id?: string;
    url: string;
    alt?: string;
    position?: number;
  }>;
  variants?: Array<{
    id: string;
    sku?: string;
    title?: string;
    priceCents?: number;
    compareAtPriceCents?: number;
    options?: Array<{ name: string; value: string }>;
    inventory?: ExternalInventory[];
  }>;
  inventory?: ExternalInventory[];
  attributes?: Record<string, unknown>;
  updatedAt?: string;
  raw?: unknown;
};

export type NormalizedProduct = {
  tenantId: string;
  title: string;
  slug?: string;
  description?: string;
  shortDescription?: string;
  sku?: string;
  brand?: string;
  status: 'active' | 'draft' | 'archived';
  currency?: string;
  priceCents: number;
  compareAtPriceCents?: number;
  categories: Array<{ id?: string; name: string }>;
  images: Array<{
    externalId?: string;
    url: string;
    altText?: string;
    position?: number;
  }>;
  variants: Array<{
    externalVariantId: string;
    sku?: string;
    title?: string;
    priceCents: number;
    compareAtPriceCents?: number;
    options: Array<{ name: string; value: string }>;
    availableQuantity?: number | null;
    isAvailable: boolean;
  }>;
  availableQuantity?: number | null;
  isAvailable: boolean;
  attributes: Record<string, unknown>;
  source: {
    integrationId: string;
    platform: CommercePlatformId;
    externalProductId: string;
    externalSku?: string;
    externalUrl?: string;
    externalUpdatedAt?: string;
  };
};

export type PlatformCapabilities = ReadonlySet<PlatformCapability>;

export type PlatformDescriptor = {
  id: CommercePlatformId;
  name: string;
  category: 'E-commerce';
  version: string;
  authenticationTypes: Array<'oauth2' | 'oauth1a' | 'api_token' | 'api_key' | 'basic'>;
  capabilities: PlatformCapability[];
  /** When false, connect is refused until a full adapter ships. */
  connectable: boolean;
  requiredCredentialFields: string[];
  summary: string;
};

export interface CommercePlatformAdapter {
  readonly platform: CommercePlatformId;
  readonly capabilities: PlatformCapabilities;
  readonly descriptor: PlatformDescriptor;

  validateConnection(
    credentials: IntegrationCredentials,
    baseUrl?: string | null,
  ): Promise<ConnectionValidationResult>;

  getStoreInformation(context: IntegrationContext): Promise<ExternalStore>;

  fetchProducts(
    context: IntegrationContext,
    options: ProductFetchOptions,
  ): Promise<PaginatedResult<ExternalProduct>>;

  fetchProductById(
    context: IntegrationContext,
    externalId: string,
  ): Promise<ExternalProduct | null>;

  fetchCategories?(
    context: IntegrationContext,
    options?: PaginationOptions,
  ): Promise<ExternalCategory[]>;

  fetchInventory?(
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

  unsubscribeFromEvents?(context: IntegrationContext): Promise<void>;

  normalizeProduct(
    product: ExternalProduct,
    context: Pick<IntegrationContext, 'tenantId' | 'integrationId'>,
  ): NormalizedProduct;

  verifyWebhook?(
    headers: Record<string, string | string[] | undefined>,
    rawBody: Buffer | string,
    credentials: IntegrationCredentials,
  ): Promise<{ valid: boolean; eventId: string; eventType: string }>;

  disconnect(context: IntegrationContext): Promise<void>;
}
