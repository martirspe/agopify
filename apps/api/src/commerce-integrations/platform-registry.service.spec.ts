import { MagentoAdapter } from './adapters/magento.adapter';
import {
  PrestaShopMappedAdapter,
  ShopifyMappedAdapter,
} from './adapters/mapped.adapters';
import { WooCommerceAdapter } from './adapters/woocommerce.adapter';
import { PlatformRegistryService } from './platform-registry.service';

describe('PlatformRegistryService', () => {
  const registry = new PlatformRegistryService(
    new MagentoAdapter(),
    new WooCommerceAdapter(),
    new ShopifyMappedAdapter(),
    new PrestaShopMappedAdapter(),
  );

  it('lists Magento and WooCommerce as connectable', () => {
    const platforms = registry.list();
    expect(platforms.find((item) => item.id === 'magento')?.connectable).toBe(true);
    expect(platforms.find((item) => item.id === 'woocommerce')?.connectable).toBe(
      true,
    );
  });

  it('maps Shopify and PrestaShop without allowing connect', () => {
    expect(registry.get('shopify').descriptor.connectable).toBe(false);
    expect(registry.get('prestashop').descriptor.connectable).toBe(false);
  });
});
