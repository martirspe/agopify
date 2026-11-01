import { Injectable } from '@nestjs/common';
import { assertSafeStoreBaseUrl, storeOrigin } from '../safe-store-url';
import { normalizeExternalProduct } from '../product-normalizer';
import type {
  CommercePlatformAdapter,
  ConnectionValidationResult,
  ExternalProduct,
  ExternalStore,
  IntegrationContext,
  IntegrationCredentials,
  NormalizedProduct,
  PaginatedResult,
  PlatformCapability,
  PlatformDescriptor,
  ProductFetchOptions,
} from '../commerce-platform.types';

const CAPABILITIES: PlatformCapability[] = [
  'products.read',
  'products.incremental_sync',
  'products.variants',
  'products.media',
  'products.categories',
  'inventory.read',
  'pricing.read',
];

type MagentoProduct = {
  id: number;
  sku: string;
  name: string;
  type_id?: string;
  status?: number;
  visibility?: number;
  price?: number;
  updated_at?: string;
  extension_attributes?: {
    stock_item?: { qty?: number; is_in_stock?: boolean };
    category_links?: Array<{ category_id: string }>;
    configurable_product_options?: Array<{
      attribute_id: string;
      label: string;
      values?: Array<{ value_index: number }>;
    }>;
  };
  custom_attributes?: Array<{ attribute_code: string; value: string }>;
  media_gallery_entries?: Array<{
    id?: number;
    file?: string;
    label?: string;
    position?: number;
    disabled?: boolean;
    media_type?: string;
  }>;
};

@Injectable()
export class MagentoAdapter implements CommercePlatformAdapter {
  readonly platform = 'magento' as const;
  readonly capabilities = new Set(CAPABILITIES);
  readonly descriptor: PlatformDescriptor = {
    id: 'magento',
    name: 'Magento / Adobe Commerce',
    category: 'E-commerce',
    version: '2.x',
    authenticationTypes: ['api_token', 'oauth1a'],
    capabilities: CAPABILITIES,
    connectable: true,
    requiredCredentialFields: ['baseUrl', 'accessToken'],
    summary:
      'Sincroniza el catálogo de Magento Open Source o Adobe Commerce mediante la REST API.',
  };

  async validateConnection(
    credentials: IntegrationCredentials,
    baseUrl?: string | null,
  ): Promise<ConnectionValidationResult> {
    const origin = await this.origin(credentials, baseUrl);
    let storeId = 'default';
    let storeName = origin.hostname;
    try {
      const store = await this.requestJson<Array<{ name?: string; code?: string }>>(
        origin,
        credentials,
        '/rest/V1/store/storeConfigs',
      );
      const first = Array.isArray(store) ? store[0] : null;
      storeId = first?.code ?? storeId;
      storeName = first?.name ?? storeName;
    } catch {
      await this.requestJson(
        origin,
        credentials,
        '/rest/V1/products?searchCriteria[pageSize]=1',
      );
    }
    return {
      ok: true,
      storeId,
      storeName,
      capabilities: CAPABILITIES,
    };
  }

  async getStoreInformation(context: IntegrationContext): Promise<ExternalStore> {
    const result = await this.validateConnection(context.credentials, context.baseUrl);
    return {
      id: result.storeId ?? 'default',
      name: result.storeName ?? 'Magento',
      url: context.baseUrl ?? undefined,
    };
  }

  async fetchProducts(
    context: IntegrationContext,
    options: ProductFetchOptions,
  ): Promise<PaginatedResult<ExternalProduct>> {
    const origin = await this.origin(context.credentials, context.baseUrl);
    const pageSize = Math.min(options.pageSize ?? 50, 100);
    const page = Number(options.cursor ?? '1') || 1;
    const params = new URLSearchParams();
    params.set('searchCriteria[pageSize]', String(pageSize));
    params.set('searchCriteria[currentPage]', String(page));
    if (options.updatedSince) {
      params.set('searchCriteria[filterGroups][0][filters][0][field]', 'updated_at');
      params.set(
        'searchCriteria[filterGroups][0][filters][0][value]',
        options.updatedSince,
      );
      params.set(
        'searchCriteria[filterGroups][0][filters][0][condition_type]',
        'gt',
      );
    }
    const payload = await this.requestJson<{
      items?: MagentoProduct[];
      total_count?: number;
    }>(origin, context.credentials, `/rest/V1/products?${params.toString()}`);
    const items: ExternalProduct[] = [];
    for (const item of payload.items ?? []) {
      items.push(
        await this.toExternalHydrated(origin, context.credentials, item),
      );
    }
    const hasMore = page * pageSize < (payload.total_count ?? items.length);
    return {
      items,
      nextCursor: hasMore ? String(page + 1) : null,
      hasMore,
    };
  }

  async fetchProductById(
    context: IntegrationContext,
    externalId: string,
  ): Promise<ExternalProduct | null> {
    const origin = await this.origin(context.credentials, context.baseUrl);
    try {
      const item = await this.requestJson<MagentoProduct>(
        origin,
        context.credentials,
        `/rest/V1/products/${encodeURIComponent(externalId)}`,
      );
      return this.toExternalHydrated(origin, context.credentials, item);
    } catch {
      return null;
    }
  }

  normalizeProduct(
    product: ExternalProduct,
    context: Pick<IntegrationContext, 'tenantId' | 'integrationId'>,
  ): NormalizedProduct {
    return normalizeExternalProduct(product, {
      ...context,
      platform: this.platform,
    });
  }

  async disconnect(_context: IntegrationContext): Promise<void> {
    /* Magento token revocation is installation-specific; credentials are dropped locally. */
  }

  private async toExternalHydrated(
    origin: URL,
    credentials: IntegrationCredentials,
    item: MagentoProduct,
  ): Promise<ExternalProduct> {
    const base = this.toExternal(item, origin);
    if (item.type_id !== 'configurable' || !item.sku) return base;
    try {
      const children = await this.requestJson<MagentoProduct[]>(
        origin,
        credentials,
        `/rest/V1/configurable-products/${encodeURIComponent(item.sku)}/children`,
      );
      const optionLabels =
        item.extension_attributes?.configurable_product_options?.map(
          (option) => option.label,
        ) ?? [];
      base.variants = children.map((child) => {
        const priceCents = Math.round(Number(child.price ?? 0) * 100);
        const stock = child.extension_attributes?.stock_item;
        const options = optionLabels
          .map((label) => {
            const code = label
              .toLowerCase()
              .replace(/\s+/g, '_');
            const value = child.custom_attributes?.find(
              (attr) =>
                attr.attribute_code === code ||
                attr.attribute_code === label.toLowerCase(),
            )?.value;
            return value ? { name: label, value: String(value) } : null;
          })
          .filter((entry): entry is { name: string; value: string } => Boolean(entry));
        return {
          id: String(child.sku || child.id),
          sku: child.sku,
          title: child.name,
          priceCents,
          options:
            options.length > 0
              ? options
              : [{ name: 'SKU', value: child.sku || String(child.id) }],
          inventory: [
            {
              quantity: stock?.qty,
              availableQuantity: stock?.qty,
              isAvailable: Boolean(stock?.is_in_stock ?? true),
            },
          ],
        };
      });
      if (base.variants.length) {
        base.priceCents = Math.min(
          ...base.variants.map((variant) => variant.priceCents ?? 0),
        );
        base.inventory = [
          {
            isAvailable: base.variants.some(
              (variant) => variant.inventory?.[0]?.isAvailable !== false,
            ),
          },
        ];
      }
    } catch {
      /* Keep configurable parent when children cannot be loaded. */
    }
    return base;
  }

  private toExternal(item: MagentoProduct, origin: URL): ExternalProduct {
    const description = item.custom_attributes?.find(
      (attr) => attr.attribute_code === 'description',
    )?.value;
    const shortDescription = item.custom_attributes?.find(
      (attr) => attr.attribute_code === 'short_description',
    )?.value;
    const stock = item.extension_attributes?.stock_item;
    const priceCents = Math.round(Number(item.price ?? 0) * 100);
    return {
      id: String(item.sku || item.id),
      title: item.name,
      sku: item.sku,
      description,
      shortDescription,
      status: item.status === 1 ? 'active' : 'draft',
      priceCents,
      updatedAt: item.updated_at,
      images: (item.media_gallery_entries ?? [])
        .filter((entry) => entry.file && !entry.disabled)
        .map((entry, index) => ({
          id: entry.id != null ? String(entry.id) : undefined,
          url: `${storeOrigin(origin)}/media/catalog/product${entry.file}`,
          alt: entry.label ?? undefined,
          position: entry.position ?? index,
        })),
      inventory: [
        {
          quantity: stock?.qty,
          availableQuantity: stock?.qty,
          isAvailable: Boolean(stock?.is_in_stock ?? true),
        },
      ],
      attributes: {
        typeId: item.type_id,
        visibility: item.visibility,
        magentoId: item.id,
      },
      raw: item,
    };
  }

  private async origin(
    credentials: IntegrationCredentials,
    baseUrl?: string | null,
  ): Promise<URL> {
    const raw = baseUrl || credentials.baseUrl;
    if (!raw) throw new Error('baseUrl required');
    return assertSafeStoreBaseUrl(raw);
  }

  private async requestJson<T>(
    origin: URL,
    credentials: IntegrationCredentials,
    path: string,
  ): Promise<T> {
    const token = credentials.accessToken;
    if (!token) throw new Error('accessToken required');
    const response = await fetch(`${storeOrigin(origin)}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      redirect: 'error',
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      throw new Error(`Magento HTTP ${response.status}`);
    }
    return (await response.json()) as T;
  }
}
