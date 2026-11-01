import {
  Prisma,
  ProductChannelKind,
  ProductStatus,
} from '@prisma/client';

export const PRODUCT_STATUSES = ['DRAFT', 'ACTIVE', 'ARCHIVED'] as const;
export const PRODUCT_CHANNELS = ['STORE', 'WHATSAPP', 'INSTAGRAM'] as const;

export type ProductStatusValue = (typeof PRODUCT_STATUSES)[number];
export type ProductChannelValue = (typeof PRODUCT_CHANNELS)[number];

export type ChannelListingInput = {
  channel: ProductChannelValue;
  isPublished: boolean;
};

export type OptionDefinitionInput = {
  name: string;
  values: string[];
};

export const PRODUCT_RELATIONS_INCLUDE = {
  variants: true,
  media: { orderBy: { sortOrder: 'asc' as const } },
  optionDefinitions: { orderBy: { position: 'asc' as const } },
  channelListings: true,
  collectionLinks: {
    orderBy: { sortOrder: 'asc' as const },
    include: {
      collection: {
        select: { id: true, handle: true, title: true, isPublished: true },
      },
    },
  },
  components: {
    orderBy: { id: 'asc' as const },
    include: {
      component: {
        select: {
          id: true,
          name: true,
          handle: true,
          sku: true,
          status: true,
          stockUnlimited: true,
          stockQty: true,
          channelListings: {
            where: { channel: ProductChannelKind.STORE },
            select: { isPublished: true },
          },
        },
      },
    },
  },
} satisfies Prisma.ProductInclude;

export function listingPublished(
  listings: Array<{ channel: ProductChannelKind; isPublished: boolean }> | undefined,
  channel: ProductChannelKind,
): boolean {
  return listings?.some((row) => row.channel === channel && row.isPublished) ?? false;
}

/** Admin/API compatibility: sellable readiness from lifecycle status. */
export function derivedIsAvailable(status: ProductStatus): boolean {
  return status === ProductStatus.ACTIVE;
}

/** Admin/API compatibility: online store visibility from channel listing. */
export function derivedIsPublishedOnStore(
  listings: Array<{ channel: ProductChannelKind; isPublished: boolean }> | undefined,
): boolean {
  return listingPublished(listings, ProductChannelKind.STORE);
}

export function storefrontProductWhere(tenantId: string): Prisma.ProductWhereInput {
  return {
    tenantId,
    status: ProductStatus.ACTIVE,
    channelListings: {
      some: { channel: ProductChannelKind.STORE, isPublished: true },
    },
  };
}

export function channelProductWhere(
  tenantId: string,
  channel: ProductChannelKind,
): Prisma.ProductWhereInput {
  return {
    tenantId,
    status: ProductStatus.ACTIVE,
    channelListings: {
      some: { channel, isPublished: true },
    },
  };
}

export function conversationChannelKind(
  channelType: string | null | undefined,
): ProductChannelKind {
  if (channelType === 'INSTAGRAM') return ProductChannelKind.INSTAGRAM;
  return ProductChannelKind.WHATSAPP;
}

export function slugifyHandle(title: string): string {
  const base = title
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'coleccion';
}

export function presentProduct<T extends {
  status: ProductStatus;
  channelListings?: Array<{ channel: ProductChannelKind; isPublished: boolean; publishedAt?: Date | null }>;
  collectionLinks?: Array<{
    collectionId: string;
    collection: { id: string; handle: string; title: string; isPublished: boolean };
  }>;
  optionDefinitions?: Array<{ id: string; name: string; position: number; values: Prisma.JsonValue }>;
  components?: Array<{
    quantity: number;
    component: {
      id: string;
      name: string;
      handle: string;
      sku: string | null;
      status: ProductStatus;
      stockUnlimited: boolean;
      stockQty: number | null;
      channelListings?: Array<{ isPublished: boolean }>;
      isAvailable?: boolean;
      isPublishedOnStore?: boolean;
    };
  }>;
}>(product: T) {
  const channelListings = product.channelListings ?? [];
  const collectionIds = (product.collectionLinks ?? []).map((link) => link.collectionId);
  const collections = (product.collectionLinks ?? []).map((link) => ({
    id: link.collection.id,
    handle: link.collection.handle,
    title: link.collection.title,
    isPublished: link.collection.isPublished,
  }));
  const components = product.components?.map((row) => ({
    ...row,
    component: {
      ...row.component,
      isAvailable: derivedIsAvailable(row.component.status),
      isPublishedOnStore:
        row.component.channelListings?.some((listing) => listing.isPublished) ?? false,
    },
  }));
  return {
    ...product,
    components,
    collectionIds,
    collections,
    isAvailable: derivedIsAvailable(product.status),
    isPublishedOnStore: derivedIsPublishedOnStore(channelListings),
  };
}
