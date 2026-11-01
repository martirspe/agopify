import { Module } from '@nestjs/common';
import { MagentoAdapter } from './adapters/magento.adapter';
import {
  PrestaShopMappedAdapter,
  ShopifyMappedAdapter,
} from './adapters/mapped.adapters';
import { WooCommerceAdapter } from './adapters/woocommerce.adapter';
import { CatalogSyncWriterService } from './catalog-sync-writer.service';
import { CommerceCredentialsService } from './commerce-credentials.service';
import { CommerceIntegrationsController } from './commerce-integrations.controller';
import { CommerceIntegrationsService } from './commerce-integrations.service';
import { CommerceSyncService } from './commerce-sync.service';
import { CommerceWebhookService } from './commerce-webhook.service';
import { PlatformRegistryService } from './platform-registry.service';

@Module({
  controllers: [CommerceIntegrationsController],
  providers: [
    CommerceCredentialsService,
    MagentoAdapter,
    WooCommerceAdapter,
    ShopifyMappedAdapter,
    PrestaShopMappedAdapter,
    PlatformRegistryService,
    CatalogSyncWriterService,
    CommerceSyncService,
    CommerceWebhookService,
    CommerceIntegrationsService,
  ],
  exports: [CommerceIntegrationsService, PlatformRegistryService],
})
export class CommerceIntegrationsModule {}
