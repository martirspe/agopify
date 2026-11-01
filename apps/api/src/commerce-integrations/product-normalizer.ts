import type {
  CommercePlatformId,
  ExternalProduct,
  NormalizedProduct,
} from './commerce-platform.types';

function cents(value: number | undefined, fallback = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.round(value));
}

function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'product';
}

/** Maps an adapter ExternalProduct into the Integration Core canonical shape (integer cents). */
export function normalizeExternalProduct(
  product: ExternalProduct,
  context: {
    tenantId: string;
    integrationId: string;
    platform: CommercePlatformId;
  },
): NormalizedProduct {
  const variants = (product.variants ?? []).map((variant) => ({
    externalVariantId: variant.id,
    sku: variant.sku,
    title: variant.title,
    priceCents: cents(variant.priceCents, cents(product.priceCents)),
    compareAtPriceCents:
      variant.compareAtPriceCents !== undefined
        ? cents(variant.compareAtPriceCents)
        : product.compareAtPriceCents !== undefined
          ? cents(product.compareAtPriceCents)
          : undefined,
    options: variant.options ?? [],
    availableQuantity: variant.inventory?.[0]?.availableQuantity ?? null,
    isAvailable: variant.inventory?.[0]?.isAvailable ?? true,
  }));

  const isAvailable =
    product.inventory?.[0]?.isAvailable ??
    (variants.length ? variants.some((variant) => variant.isAvailable) : true);

  return {
    tenantId: context.tenantId,
    title: product.title.trim() || 'Producto',
    slug: product.slug?.trim() || slugify(product.title),
    description: product.description,
    shortDescription: product.shortDescription,
    sku: product.sku,
    brand: product.brand,
    status:
      product.status === 'archived' || product.status === 'draft'
        ? product.status
        : 'active',
    currency: product.currency,
    priceCents: cents(product.priceCents),
    compareAtPriceCents:
      product.compareAtPriceCents !== undefined
        ? cents(product.compareAtPriceCents)
        : undefined,
    categories: (product.categories ?? []).map((category) => ({
      id: category.id,
      name: category.name,
    })),
    images: (product.images ?? []).map((image, index) => ({
      externalId: image.id,
      url: image.url,
      altText: image.alt,
      position: image.position ?? index,
    })),
    variants,
    availableQuantity: product.inventory?.[0]?.availableQuantity ?? null,
    isAvailable,
    attributes: product.attributes ?? {},
    source: {
      integrationId: context.integrationId,
      platform: context.platform,
      externalProductId: product.id,
      externalSku: product.sku,
      externalUpdatedAt: product.updatedAt,
    },
  };
}

export function handleForExternalProduct(
  platform: CommercePlatformId,
  externalProductId: string,
  slug?: string,
): string {
  const base = slugify(slug || externalProductId);
  return `${platform}-${externalProductId}-${base}`.slice(0, 120);
}
