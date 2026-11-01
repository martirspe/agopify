/**
 * Builds a catalog package (`catalog.json` + image paths) that
 * `parseCatalogPackage` / Importar catálogo can round-trip.
 * Variants are collapsed to the parent product (package format has no variants).
 */

export type ExportMedia = {
  url: string;
  kind: string;
  alt: string | null;
  caption: string | null;
  sortOrder: number;
};

export type ExportComponent = {
  quantity: number;
  component: {
    handle: string;
    name: string;
    sku: string | null;
  };
};

export type ExportProduct = {
  handle: string;
  name: string;
  descriptionShort: string | null;
  descriptionFull: string | null;
  categories: string[];
  basePriceCents: number;
  kind: string;
  durationMinutes: number | null;
  serviceMode: string | null;
  digitalAccessUrl: string | null;
  digitalInstructions: string | null;
  /** Lifecycle: DRAFT | ACTIVE | ARCHIVED. */
  status: string;
  stockUnlimited: boolean;
  stockQty: number | null;
  /** One row per sales channel (STORE, WHATSAPP, INSTAGRAM). */
  channelListings: Array<{ channel: string; isPublished: boolean }>;
  brand: string | null;
  sku: string | null;
  line: string | null;
  details: Record<string, unknown> | null;
  seoTitle: string | null;
  seoDescription: string | null;
  sortOrder: number;
  media: ExportMedia[];
  components: ExportComponent[];
  variants: Array<{ id: string }>;
};

export type ExportStore = {
  industry: string | null;
  template: string | null;
  freeShippingFromCents: number | null;
  shippingOriginUbigeo: string | null;
  carrierRates: unknown;
  heroImageUrl: string | null;
  bannerImageUrl: string | null;
};

export type ExportImageFile = {
  /** Path inside the package, e.g. `images/products/mi-producto/foto-1.webp`. */
  path: string;
  url: string;
};

export type CatalogExportPackage = {
  catalog: {
    source: string;
    store?: Record<string, unknown>;
    inventory: Array<{ sku: string; stock: number }>;
    products: unknown[];
  };
  images: ExportImageFile[];
  warnings: string[];
};

const IMAGE_EXT = /\.(jpe?g|png|webp)$/i;

function extFromUrl(url: string): string {
  const match = url.split('?')[0]?.match(IMAGE_EXT);
  return match ? match[0].toLowerCase() : '.webp';
}

function detailsObject(
  details: Record<string, unknown> | null,
): Record<string, unknown> {
  if (!details || typeof details !== 'object' || Array.isArray(details)) {
    return {};
  }
  return { ...details };
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
}

/**
 * Serializes tenant products into the import package shape plus image download list.
 * Sets come after their pieces in the file (pieces first) so import ownership resolves.
 */
export function buildCatalogExport(
  products: ExportProduct[],
  store: ExportStore | null,
  options?: { source?: string; now?: Date },
): CatalogExportPackage {
  const warnings: string[] = [];
  const images: ExportImageFile[] = [];
  const inventory: Array<{ sku: string; stock: number }> = [];
  const inventorySeen = new Set<string>();

  const withVariants = products.filter((p) => p.variants.length > 0).length;
  if (withVariants) {
    warnings.push(
      `${withVariants} producto${withVariants === 1 ? '' : 's'} con variantes: el paquete guarda solo el precio y stock del producto base. Revisa las variantes después de importar.`,
    );
  }

  const pieces = products.filter((p) => !p.components.length);
  const sets = products.filter((p) => p.components.length > 0);
  const ordered = [...pieces, ...sets];

  const packageProducts = ordered.map((product) => {
    const isSet = product.components.length > 0;
    const mediaSorted = [...product.media].sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );
    const imageEntries = mediaSorted.slice(0, 12).map((media, index) => {
      const ext = extFromUrl(media.url);
      const file = `foto-${index + 1}${ext}`;
      const path = `images/products/${product.handle}/${file}`;
      images.push({ path, url: media.url });
      return {
        url: `/${path}`,
        file,
        kind: media.kind === 'related' ? 'related' : 'image',
        alt: media.alt,
        caption: media.caption,
      };
    });

    const details = detailsObject(product.details);
    const size =
      typeof details['size'] === 'string' ? details['size'] : null;

    if (
      product.kind === 'PRODUCT' &&
      !isSet &&
      product.sku &&
      !product.stockUnlimited &&
      product.stockQty !== null &&
      !inventorySeen.has(product.sku)
    ) {
      inventorySeen.add(product.sku);
      inventory.push({ sku: product.sku, stock: Math.max(0, product.stockQty) });
    }

    const content: Record<string, unknown> = {
      title: product.seoTitle ?? product.name,
      summary: product.descriptionShort,
      description: product.descriptionFull,
      brand: product.brand,
      line: product.line,
      benefits: stringList(details['benefits']),
      usage: stringList(details['usage']),
      notes: stringList(details['notes']),
      montage: details['montage'] === true,
      details,
      images: imageEntries,
      format: isSet ? 'set' : 'single',
    };

    if (!isSet) {
      content['inventory'] = product.sku
        ? [{ sku: product.sku, quantity: 1 }]
        : [];
      if (size) {
        content['includes'] = [
          {
            name: product.name,
            size,
            details: stringList(details['highlights']),
          },
        ];
      }
    } else {
      content['inventory'] = product.components.map((row) => ({
        sku: row.component.sku ?? row.component.handle,
        quantity: Math.max(1, Math.min(20, row.quantity)),
      }));
      content['includes'] = product.components.map((row) => ({
        code: row.component.sku,
        name: row.component.name,
        productSlug: row.component.handle,
        size: null,
        details: [],
      }));
      for (const row of product.components) {
        const sku = row.component.sku;
        if (!sku || inventorySeen.has(sku)) continue;
        const piece = pieces.find((p) => p.handle === row.component.handle);
        if (
          piece &&
          !piece.stockUnlimited &&
          piece.stockQty !== null &&
          piece.kind === 'PRODUCT'
        ) {
          inventorySeen.add(sku);
          inventory.push({ sku, stock: Math.max(0, piece.stockQty) });
        }
      }
    }

    const entry: Record<string, unknown> = {
      slug: product.handle,
      name: product.name,
      categories: product.categories,
      category: product.categories[0] ?? null,
      priceCents: product.basePriceCents,
      // active stays for packages read by older versions; status and channelListings are the source of truth.
      active: product.status === 'ACTIVE',
      status: product.status,
      channelListings: product.channelListings.map((row) => ({
        channel: row.channel,
        isPublished: row.isPublished,
      })),
      content,
    };
    if (product.kind && product.kind !== 'PRODUCT') {
      entry['kind'] = product.kind;
    }
    if (product.kind === 'SERVICE') {
      entry['durationMinutes'] = product.durationMinutes;
      entry['serviceMode'] = product.serviceMode;
    }
    if (product.kind === 'DIGITAL') {
      entry['digitalAccessUrl'] = product.digitalAccessUrl;
      entry['digitalInstructions'] = product.digitalInstructions;
    }
    return entry;
  });

  const when = (options?.now ?? new Date()).toISOString().slice(0, 10);
  const catalog: CatalogExportPackage['catalog'] = {
    source:
      options?.source ??
      `VendedorIA (export ${when}, ${packageProducts.length} productos)`,
    inventory,
    products: packageProducts,
  };

  if (store) {
    const storeBlock: Record<string, unknown> = {
      industry: store.industry,
      template: store.template,
      freeShippingFromCents: store.freeShippingFromCents,
      shippingOriginUbigeo: store.shippingOriginUbigeo,
      carrierRates: store.carrierRates,
    };
    if (store.heroImageUrl) {
      const path = 'images/store/hero.webp';
      images.push({ path, url: store.heroImageUrl });
      storeBlock['heroImage'] = `/${path}`;
    }
    if (store.bannerImageUrl) {
      const path = 'images/store/banner.webp';
      images.push({ path, url: store.bannerImageUrl });
      storeBlock['bannerImage'] = `/${path}`;
    }
    catalog.store = storeBlock;
  }

  return { catalog, images, warnings };
}

/** Uncompressed (STORED) ZIP — enough for already-compressed WebP/JPEG photos. */
export function buildStoredZip(
  files: Array<{ path: string; bytes: Buffer }>,
): Buffer {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const name = Buffer.from(file.path.replace(/^\/+/, ''), 'utf8');
    const data = file.bytes;
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc >>> 0, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    parts.push(local, name, data);

    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0);
    cen.writeUInt16LE(20, 4);
    cen.writeUInt16LE(20, 6);
    cen.writeUInt16LE(0, 8);
    cen.writeUInt16LE(0, 10);
    cen.writeUInt16LE(0, 12);
    cen.writeUInt16LE(0, 14);
    cen.writeUInt32LE(crc >>> 0, 16);
    cen.writeUInt32LE(data.length, 20);
    cen.writeUInt32LE(data.length, 24);
    cen.writeUInt16LE(name.length, 28);
    cen.writeUInt16LE(0, 30);
    cen.writeUInt16LE(0, 32);
    cen.writeUInt16LE(0, 34);
    cen.writeUInt16LE(0, 36);
    cen.writeUInt32LE(0, 38);
    cen.writeUInt32LE(offset, 42);
    central.push(cen, name);
    offset += local.length + name.length + data.length;
  }

  const centralSize = central.reduce((sum, buf) => sum + buf.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...parts, ...central, end]);
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
