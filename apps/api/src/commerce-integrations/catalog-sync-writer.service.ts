import { Injectable } from '@nestjs/common';
import { Prisma, ProductChannelKind, ProductStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { NormalizedProduct } from './commerce-platform.types';
import { handleForExternalProduct } from './product-normalizer';

export type CatalogWriteResult = {
  operation: 'created' | 'updated' | 'unchanged';
  productId: string;
};

/**
 * Upserts a normalized external product into the existing unified Product catalog.
 * Manual products without a CommerceIntegrationResource mapping are never overwritten by external id alone.
 */
@Injectable()
export class CatalogSyncWriterService {
  constructor(private readonly prisma: PrismaService) {}

  async upsertNormalizedProduct(
    tenantId: string,
    integrationId: string,
    product: NormalizedProduct,
  ): Promise<CatalogWriteResult> {
    const existingMap = await this.prisma.commerceIntegrationResource.findUnique({
      where: {
        integrationId_resourceType_externalId: {
          integrationId,
          resourceType: 'PRODUCT',
          externalId: product.source.externalProductId,
        },
      },
    });

    const handle = handleForExternalProduct(
      product.source.platform,
      product.source.externalProductId,
      product.slug,
    );

    const stockUnlimited = product.availableQuantity == null;
    const status =
      product.status === 'active' && product.isAvailable ? ProductStatus.ACTIVE : ProductStatus.DRAFT;
    const data = {
      name: product.title,
      descriptionShort: product.shortDescription?.slice(0, 280) ?? null,
      descriptionFull: product.description ?? null,
      categories: product.categories.map((category) => category.name).slice(0, 20),
      basePriceCents: product.priceCents,
      compareAtPriceCents: product.compareAtPriceCents ?? null,
      currency: product.currency?.slice(0, 3).toUpperCase() || 'PEN',
      brand: product.brand ?? null,
      sku: product.sku ?? null,
      stockUnlimited,
      stockQty: stockUnlimited ? null : Math.max(0, product.availableQuantity ?? 0),
      attributeValues: product.attributes as Prisma.InputJsonValue,
    };

    if (existingMap?.internalId) {
      const current = await this.prisma.product.findFirst({
        where: { id: existingMap.internalId, tenantId },
      });
      if (current) {
        const unchanged =
          current.name === data.name &&
          current.basePriceCents === data.basePriceCents &&
          (current.status === ProductStatus.ARCHIVED || current.status === status) &&
          current.stockQty === data.stockQty;
        if (!unchanged) {
          await this.prisma.product.update({
            where: { id: current.id },
            // An archived product stays archived: the merchant retired it on purpose.
            data: current.status === ProductStatus.ARCHIVED ? data : { ...data, status },
          });
        }
        await this.touchMapping(existingMap.id, product);
        if (product.variants.length) {
          await this.syncVariants(current.id, product);
        }
        await this.syncMedia(current.id, product);
        return {
          operation: unchanged ? 'unchanged' : 'updated',
          productId: current.id,
        };
      }
    }

    const created = await this.prisma.product.create({
      data: {
        tenantId,
        handle,
        ...data,
        status,
        // Imported products are sellable in chats right away; the store stays opt-in.
        channelListings: {
          create: (Object.values(ProductChannelKind) as ProductChannelKind[]).map((channel) => {
            const isPublished = status === ProductStatus.ACTIVE && channel !== ProductChannelKind.STORE;
            return { channel, isPublished, publishedAt: isPublished ? new Date() : null };
          }),
        },
      },
    });

    await this.prisma.commerceIntegrationResource.upsert({
      where: {
        integrationId_resourceType_externalId: {
          integrationId,
          resourceType: 'PRODUCT',
          externalId: product.source.externalProductId,
        },
      },
      create: {
        tenantId,
        integrationId,
        resourceType: 'PRODUCT',
        externalId: product.source.externalProductId,
        internalId: created.id,
        externalUpdatedAt: product.source.externalUpdatedAt
          ? new Date(product.source.externalUpdatedAt)
          : null,
        lastSyncedAt: new Date(),
        metadata: { platform: product.source.platform },
      },
      update: {
        internalId: created.id,
        lastSyncedAt: new Date(),
        externalUpdatedAt: product.source.externalUpdatedAt
          ? new Date(product.source.externalUpdatedAt)
          : null,
      },
    });

    if (product.variants.length) {
      await this.syncVariants(created.id, product);
    }
    await this.syncMedia(created.id, product);
    return { operation: 'created', productId: created.id };
  }

  private async touchMapping(id: string, product: NormalizedProduct): Promise<void> {
    await this.prisma.commerceIntegrationResource.update({
      where: { id },
      data: {
        lastSyncedAt: new Date(),
        externalUpdatedAt: product.source.externalUpdatedAt
          ? new Date(product.source.externalUpdatedAt)
          : null,
      },
    });
  }

  private async syncVariants(
    productId: string,
    product: NormalizedProduct,
  ): Promise<void> {
    for (const variant of product.variants.slice(0, 100)) {
      const options = variant.options.slice(0, 3);
      const combinationKey =
        options.map((option) => `${option.name}=${option.value}`).join('|') ||
        variant.externalVariantId;
      await this.prisma.productVariant.upsert({
        where: {
          productId_combinationKey: { productId, combinationKey },
        },
        create: {
          productId,
          sku: variant.sku ?? null,
          priceCents: variant.priceCents,
          isAvailable: variant.isAvailable,
          stockQty: variant.availableQuantity ?? null,
          option1Name: options[0]?.name ?? null,
          option1Value: options[0]?.value ?? null,
          option2Name: options[1]?.name ?? null,
          option2Value: options[1]?.value ?? null,
          option3Name: options[2]?.name ?? null,
          option3Value: options[2]?.value ?? null,
          options: options as unknown as Prisma.InputJsonValue,
          combinationKey,
        },
        update: {
          sku: variant.sku ?? null,
          priceCents: variant.priceCents,
          isAvailable: variant.isAvailable,
          stockQty: variant.availableQuantity ?? null,
        },
      });
    }
  }

  private async syncMedia(
    productId: string,
    product: NormalizedProduct,
  ): Promise<void> {
    if (!product.images.length) return;
    const existing = await this.prisma.productMedia.count({ where: { productId } });
    if (existing > 0) return;
    await this.prisma.productMedia.createMany({
      data: product.images.slice(0, 12).map((image, index) => ({
        productId,
        url: image.url,
        alt: image.altText ?? null,
        sortOrder: image.position ?? index,
        kind: 'image',
        sourceHash: image.externalId
          ? `ext:${product.source.platform}:${image.externalId}`
          : null,
      })),
    });
  }
}
