import { Injectable, NotFoundException } from '@nestjs/common';
import { MagentoAdapter } from './adapters/magento.adapter';
import {
  PrestaShopMappedAdapter,
  ShopifyMappedAdapter,
} from './adapters/mapped.adapters';
import { WooCommerceAdapter } from './adapters/woocommerce.adapter';
import type {
  CommercePlatformAdapter,
  CommercePlatformId,
  PlatformDescriptor,
} from './commerce-platform.types';

@Injectable()
export class PlatformRegistryService {
  private readonly adapters: Map<CommercePlatformId, CommercePlatformAdapter>;

  constructor(
    magento: MagentoAdapter,
    woocommerce: WooCommerceAdapter,
    shopify: ShopifyMappedAdapter,
    prestashop: PrestaShopMappedAdapter,
  ) {
    this.adapters = new Map<CommercePlatformId, CommercePlatformAdapter>();
    this.adapters.set(magento.platform, magento);
    this.adapters.set(woocommerce.platform, woocommerce);
    this.adapters.set(shopify.platform, shopify);
    this.adapters.set(prestashop.platform, prestashop);
  }

  list(): PlatformDescriptor[] {
    return [...this.adapters.values()].map((adapter) => adapter.descriptor);
  }

  get(platform: CommercePlatformId): CommercePlatformAdapter {
    const adapter = this.adapters.get(platform);
    if (!adapter) {
      throw new NotFoundException(`La plataforma ${platform} no está registrada.`);
    }
    return adapter;
  }

  has(platform: string): platform is CommercePlatformId {
    return this.adapters.has(platform as CommercePlatformId);
  }
}
