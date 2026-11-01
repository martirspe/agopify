import { Injectable } from '@nestjs/common';
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

/** Registry placeholders for platforms mapped but not yet connectable. */
abstract class MappedAdapter implements CommercePlatformAdapter {
  abstract readonly platform: 'shopify' | 'prestashop';
  abstract readonly capabilities: ReadonlySet<PlatformCapability>;
  abstract readonly descriptor: PlatformDescriptor;

  async validateConnection(
    _credentials: IntegrationCredentials,
    _baseUrl?: string | null,
  ): Promise<ConnectionValidationResult> {
    return {
      ok: false,
      message: `El conector de ${this.descriptor.name} está mapeado y llegará en un hito posterior.`,
    };
  }

  async getStoreInformation(_context: IntegrationContext): Promise<ExternalStore> {
    throw new Error(`${this.platform} adapter is not connectable yet`);
  }

  async fetchProducts(
    _context: IntegrationContext,
    _options: ProductFetchOptions,
  ): Promise<PaginatedResult<ExternalProduct>> {
    throw new Error(`${this.platform} adapter is not connectable yet`);
  }

  async fetchProductById(
    _context: IntegrationContext,
    _externalId: string,
  ): Promise<ExternalProduct | null> {
    throw new Error(`${this.platform} adapter is not connectable yet`);
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

  async disconnect(_context: IntegrationContext): Promise<void> {}
}

@Injectable()
export class ShopifyMappedAdapter extends MappedAdapter {
  readonly platform = 'shopify' as const;
  readonly capabilities = new Set<PlatformCapability>([
    'products.read',
    'products.bulk_read',
    'products.incremental_sync',
    'products.webhooks',
    'products.variants',
    'products.media',
    'products.categories',
    'inventory.read',
    'inventory.multi_location',
    'pricing.read',
    'metafields.read',
  ]);
  readonly descriptor: PlatformDescriptor = {
    id: 'shopify',
    name: 'Shopify',
    category: 'E-commerce',
    version: 'Admin GraphQL',
    authenticationTypes: ['oauth2'],
    capabilities: [...this.capabilities],
    connectable: false,
    requiredCredentialFields: [],
    summary:
      'Conector mapeado (OAuth, GraphQL Admin, Bulk Operations y webhooks). Disponible en un hito posterior.',
  };
}

@Injectable()
export class PrestaShopMappedAdapter extends MappedAdapter {
  readonly platform = 'prestashop' as const;
  readonly capabilities = new Set<PlatformCapability>([
    'products.read',
    'products.variants',
    'products.media',
    'products.categories',
    'inventory.read',
    'pricing.read',
  ]);
  readonly descriptor: PlatformDescriptor = {
    id: 'prestashop',
    name: 'PrestaShop',
    category: 'E-commerce',
    version: 'Webservice',
    authenticationTypes: ['api_key'],
    capabilities: [...this.capabilities],
    connectable: false,
    requiredCredentialFields: [],
    summary:
      'Conector mapeado sobre la Webservice API. Disponible cuando el Integration Core estabilice Magento y WooCommerce.',
  };
}
