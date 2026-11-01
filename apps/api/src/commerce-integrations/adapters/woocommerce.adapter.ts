import { createHmac, timingSafeEqual } from 'node:crypto';
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
  'products.webhooks',
  'products.variants',
  'products.media',
  'products.categories',
  'inventory.read',
  'pricing.read',
];

type WooProduct = {
  id: number;
  name: string;
  slug?: string;
  status?: string;
  description?: string;
  short_description?: string;
  sku?: string;
  price?: string;
  regular_price?: string;
  sale_price?: string;
  stock_quantity?: number | null;
  stock_status?: string;
  date_modified_gmt?: string;
  categories?: Array<{ id: number; name: string }>;
  images?: Array<{ id?: number; src: string; alt?: string; position?: number }>;
  attributes?: Array<{ name: string; options?: string[]; variation?: boolean }>;
  variations?: number[];
  type?: string;
};

type WooVariation = {
  id: number;
  sku?: string;
  price?: string;
  regular_price?: string;
  sale_price?: string;
  stock_quantity?: number | null;
  stock_status?: string;
  attributes?: Array<{ name: string; option?: string }>;
  image?: { id?: number; src?: string; alt?: string } | null;
};

@Injectable()
export class WooCommerceAdapter implements CommercePlatformAdapter {
  readonly platform = 'woocommerce' as const;
  readonly capabilities = new Set(CAPABILITIES);
  readonly descriptor: PlatformDescriptor = {
    id: 'woocommerce',
    name: 'WooCommerce',
    category: 'E-commerce',
    version: 'REST v3',
    authenticationTypes: ['api_key', 'basic'],
    capabilities: CAPABILITIES,
    connectable: true,
    requiredCredentialFields: ['baseUrl', 'consumerKey', 'consumerSecret'],
    summary:
      'Importa productos, variantes e inventario de WooCommerce con REST y webhooks.',
  };

  async validateConnection(
    credentials: IntegrationCredentials,
    baseUrl?: string | null,
  ): Promise<ConnectionValidationResult> {
    const origin = await this.origin(credentials, baseUrl);
    let storeName = origin.hostname;
    try {
      const system = await this.requestJson<{
        environment?: { home_url?: string; site_title?: string };
        settings?: { title?: string };
      }>(origin, credentials, '/wp-json/wc/v3/system_status');
      storeName =
        system.environment?.site_title ||
        system.settings?.title ||
        storeName;
    } catch {
      await this.requestJson(
        origin,
        credentials,
        '/wp-json/wc/v3/products?per_page=1',
      );
    }
    return {
      ok: true,
      storeId: origin.host,
      storeName,
      capabilities: CAPABILITIES,
    };
  }

  async getStoreInformation(context: IntegrationContext): Promise<ExternalStore> {
    const result = await this.validateConnection(context.credentials, context.baseUrl);
    return {
      id: result.storeId ?? 'woo',
      name: result.storeName ?? 'WooCommerce',
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
    const params = new URLSearchParams({
      per_page: String(pageSize),
      page: String(page),
    });
    if (options.updatedSince) params.set('modified_after', options.updatedSince);
    const { body, headers } = await this.requestRaw(
      origin,
      context.credentials,
      `/wp-json/wc/v3/products?${params.toString()}`,
    );
    const products = JSON.parse(body) as WooProduct[];
    const items: ExternalProduct[] = [];
    for (const item of products) {
      items.push(await this.toExternalHydrated(origin, context.credentials, item));
    }
    const totalPages = Number(headers.get('x-wp-totalpages') ?? page);
    const hasMore = page < totalPages;
    return { items, nextCursor: hasMore ? String(page + 1) : null, hasMore };
  }

  async fetchProductById(
    context: IntegrationContext,
    externalId: string,
  ): Promise<ExternalProduct | null> {
    const origin = await this.origin(context.credentials, context.baseUrl);
    try {
      const item = await this.requestJson<WooProduct>(
        origin,
        context.credentials,
        `/wp-json/wc/v3/products/${encodeURIComponent(externalId)}`,
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

  async verifyWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: Buffer | string,
    credentials: IntegrationCredentials,
  ): Promise<{ valid: boolean; eventId: string; eventType: string }> {
    const signatureHeader = headers['x-wc-webhook-signature'];
    const signature = Array.isArray(signatureHeader)
      ? signatureHeader[0]
      : signatureHeader;
    const topicHeader = headers['x-wc-webhook-topic'];
    const topic = Array.isArray(topicHeader) ? topicHeader[0] : topicHeader;
    const deliveryHeader = headers['x-wc-webhook-delivery-id'];
    const deliveryId = Array.isArray(deliveryHeader)
      ? deliveryHeader[0]
      : deliveryHeader;
    const secret = credentials.webhookSecret || credentials.consumerSecret;
    if (!signature || !secret) {
      return {
        valid: false,
        eventId: deliveryId || `woo-${Date.now()}`,
        eventType: topic || 'unknown',
      };
    }
    const body = typeof rawBody === 'string' ? Buffer.from(rawBody) : rawBody;
    const digest = createHmac('sha256', secret).update(body).digest('base64');
    const expected = Buffer.from(digest);
    const received = Buffer.from(signature);
    const valid =
      expected.length === received.length &&
      timingSafeEqual(expected, received);
    return {
      valid,
      eventId: deliveryId || `woo-${digest.slice(0, 24)}`,
      eventType: topic || 'unknown',
    };
  }

  async disconnect(_context: IntegrationContext): Promise<void> {
    /* Local credential drop is enough for REST keys. */
  }

  private async toExternalHydrated(
    origin: URL,
    credentials: IntegrationCredentials,
    item: WooProduct,
  ): Promise<ExternalProduct> {
    const base = this.toExternal(item);
    if (item.type !== 'variable' || !(item.variations?.length)) return base;
    try {
      const variations = await this.requestJson<WooVariation[]>(
        origin,
        credentials,
        `/wp-json/wc/v3/products/${item.id}/variations?per_page=100`,
      );
      base.variants = variations.map((variation) => {
        const price = Number(variation.price || variation.regular_price || 0);
        const compare = variation.sale_price
          ? Number(variation.regular_price || 0)
          : undefined;
        return {
          id: String(variation.id),
          sku: variation.sku,
          title: (variation.attributes ?? [])
            .map((attr) => attr.option)
            .filter(Boolean)
            .join(' / '),
          priceCents: Math.round(price * 100),
          compareAtPriceCents:
            compare && compare > price ? Math.round(compare * 100) : undefined,
          options: (variation.attributes ?? [])
            .filter((attr) => attr.name && attr.option)
            .map((attr) => ({ name: attr.name, value: String(attr.option) })),
          inventory: [
            {
              availableQuantity: variation.stock_quantity ?? undefined,
              quantity: variation.stock_quantity ?? undefined,
              isAvailable: variation.stock_status !== 'outofstock',
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
      /* Keep parent product when variation fetch fails. */
    }
    return base;
  }

  private toExternal(item: WooProduct): ExternalProduct {
    const price = Number(item.price || item.regular_price || 0);
    const compare = item.sale_price
      ? Number(item.regular_price || 0)
      : undefined;
    return {
      id: String(item.id),
      title: item.name,
      slug: item.slug,
      description: item.description,
      shortDescription: item.short_description,
      sku: item.sku,
      status: item.status === 'publish' ? 'active' : 'draft',
      priceCents: Math.round(price * 100),
      compareAtPriceCents:
        compare && compare > price ? Math.round(compare * 100) : undefined,
      updatedAt: item.date_modified_gmt
        ? `${item.date_modified_gmt}Z`
        : undefined,
      categories: (item.categories ?? []).map((category) => ({
        id: String(category.id),
        name: category.name,
      })),
      images: (item.images ?? []).map((image, index) => ({
        id: image.id != null ? String(image.id) : undefined,
        url: image.src,
        alt: image.alt,
        position: image.position ?? index,
      })),
      inventory: [
        {
          availableQuantity: item.stock_quantity ?? undefined,
          quantity: item.stock_quantity ?? undefined,
          isAvailable: item.stock_status !== 'outofstock',
        },
      ],
      attributes: {
        type: item.type,
        variationIds: item.variations,
        wooAttributes: item.attributes,
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

  private authHeader(credentials: IntegrationCredentials): string {
    const key = credentials.consumerKey;
    const secret = credentials.consumerSecret;
    if (!key || !secret) throw new Error('consumerKey/secret required');
    return `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}`;
  }

  private async requestJson<T>(
    origin: URL,
    credentials: IntegrationCredentials,
    path: string,
  ): Promise<T> {
    const { body } = await this.requestRaw(origin, credentials, path);
    return JSON.parse(body) as T;
  }

  private async requestRaw(
    origin: URL,
    credentials: IntegrationCredentials,
    path: string,
  ): Promise<{ body: string; headers: Headers }> {
    const response = await fetch(`${storeOrigin(origin)}${path}`, {
      headers: {
        Authorization: this.authHeader(credentials),
        Accept: 'application/json',
      },
      redirect: 'error',
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`WooCommerce HTTP ${response.status}`);
    return { body: await response.text(), headers: response.headers };
  }
}
