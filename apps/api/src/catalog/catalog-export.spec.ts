import {
  buildCatalogExport,
  buildStoredZip,
  type ExportProduct,
} from './catalog-export';
import { parseCatalogPackage } from './catalog-import';

const base = (overrides: Partial<ExportProduct> = {}): ExportProduct => ({
  handle: 'colonia-floral',
  name: 'Colonia Floral',
  descriptionShort: 'Aroma fresco',
  descriptionFull: 'Descripción larga de la colonia.',
  categories: ['Perfumería'],
  basePriceCents: 9900,
  kind: 'PRODUCT',
  durationMinutes: null,
  serviceMode: null,
  digitalAccessUrl: null,
  digitalInstructions: null,
  isAvailable: true,
  stockUnlimited: false,
  stockQty: 12,
  isPublishedOnStore: true,
  brand: 'Marca',
  sku: 'COL-01',
  line: 'Floral',
  details: { size: '100 ml', benefits: ['Larga duración'], montage: false },
  seoTitle: 'Colonia Floral 100 ml',
  seoDescription: 'Aroma fresco',
  sortOrder: 0,
  media: [
    {
      url: 'http://localhost:3000/api/v1/media/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.webp',
      kind: 'image',
      alt: 'Frasco',
      caption: null,
      sortOrder: 0,
    },
  ],
  components: [],
  variants: [],
  ...overrides,
});

describe('buildCatalogExport', () => {
  it('builds a package that parseCatalogPackage accepts', () => {
    const { catalog, images, warnings } = buildCatalogExport([base()], null, {
      source: 'test',
      now: new Date('2026-10-31T00:00:00Z'),
    });
    expect(warnings).toEqual([]);
    expect(images).toHaveLength(1);
    expect(images[0].path).toBe(
      'images/products/colonia-floral/foto-1.webp',
    );
    expect(catalog.inventory).toEqual([{ sku: 'COL-01', stock: 12 }]);

    const parsed = parseCatalogPackage(JSON.stringify(catalog));
    expect(parsed.issues.filter((i) => i.level === 'error')).toEqual([]);
    expect(parsed.products).toHaveLength(1);
    expect(parsed.products[0]).toMatchObject({
      handle: 'colonia-floral',
      name: 'Colonia Floral',
      sku: 'COL-01',
      priceCents: 9900,
      stockQty: 12,
    });
  });

  it('warns when variants are collapsed and orders sets after pieces', () => {
    const piece = base({ handle: 'pieza-a', sku: 'P-A', name: 'Pieza A' });
    const set = base({
      handle: 'set-duo',
      sku: null,
      name: 'Set Duo',
      stockQty: null,
      stockUnlimited: true,
      media: [],
      components: [
        {
          quantity: 1,
          component: { handle: 'pieza-a', name: 'Pieza A', sku: 'P-A' },
        },
      ],
      variants: [{ id: 'v1' }],
    });
    const { catalog, warnings } = buildCatalogExport([set, piece], null);
    expect(warnings.some((line) => line.includes('variantes'))).toBe(true);
    expect(
      (catalog.products as Array<{ slug: string }>).map((p) => p.slug),
    ).toEqual(['pieza-a', 'set-duo']);
  });
});

describe('buildStoredZip', () => {
  it('writes a readable ZIP with catalog.json', () => {
    const zip = buildStoredZip([
      { path: 'catalog.json', bytes: Buffer.from('{"products":[]}', 'utf8') },
    ]);
    expect(zip.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))).toBe(
      true,
    );
    expect(zip.includes(Buffer.from('catalog.json'))).toBe(true);
  });
});
