/**
 * Loads Shopify Standard Product Taxonomy (es) into CatalogCategory.
 * Idempotent replace: clears legacy rows, inserts full tree, remaps product categoryIds.
 *
 * Source: apps/api/prisma/data/shopify-taxonomy.es.json.gz (UTF-8, v2025-12).
 */
import { createGunzip } from 'node:zlib';
import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gzPath = path.join(root, 'apps/api/prisma/data/shopify-taxonomy.es.json.gz');

/** Legacy Agopify ids → Shopify taxonomy handles (es, v2025-12). */
const LEGACY_CATEGORY_MAP = {
  fashion: 'aa',
  footwear: 'aa-8',
  sandals: 'aa-8-6',
  sneakers: 'aa-8-8',
  beauty: 'hb',
  skin_care: 'hb-3-2-9',
  creams: 'hb-3-2-9-20',
  fragrances: 'hb-3-2-8',
  electronics: 'el',
  home: 'hg',
  services: 'se',
  digital: 'so',
};

const LEGACY_ATTR_KEY_MAP = {
  size: 'shoe-size',
  footwear_material: 'footwear-material',
  closure: 'closure-type',
  heel_height: 'heel-height-type',
  sandal_style: 'sandal-style',
  toe_style: 'toe-style',
  audience: 'target-gender',
  age_group: 'age-group',
  care: 'care-instructions',
  lining: 'lining-material',
  occasion: 'occasion-style',
  outsole: 'outsole-material',
  features: 'shoe-features',
  fit: 'shoe-fit',
  material: 'material',
  color: 'color',
};

async function readTaxonomy() {
  const chunks = [];
  const stream = createReadStream(gzPath).pipe(createGunzip());
  for await (const chunk of Readable.from(stream)) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function remapAttributeValues(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const next = {};
  for (const [key, value] of Object.entries(raw)) {
    next[LEGACY_ATTR_KEY_MAP[key] ?? key] = value;
  }
  return Object.keys(next).length ? next : null;
}

async function main() {
  const taxonomy = await readTaxonomy();
  const categories = taxonomy.categories;
  if (!Array.isArray(categories) || categories.length < 1000) {
    throw new Error('Taxonomy file is missing or incomplete.');
  }

  const prisma = new PrismaClient();
  const keep = new Set(categories.map((row) => row.id));

  try {
    const products = await prisma.product.findMany({
      where: { OR: [{ categoryId: { not: null } }, { attributeValues: { not: null } }] },
      select: { id: true, categoryId: true, attributeValues: true },
    });

    const remaps = products.map((product) => {
      const legacyId = product.categoryId;
      let nextId = null;
      if (legacyId && keep.has(legacyId)) nextId = legacyId;
      else if (legacyId && LEGACY_CATEGORY_MAP[legacyId]) nextId = LEGACY_CATEGORY_MAP[legacyId];
      if (nextId && !keep.has(nextId)) nextId = null;
      return {
        id: product.id,
        categoryId: nextId,
        attributeValues: remapAttributeValues(product.attributeValues),
      };
    });

    await prisma.$transaction(
      async (tx) => {
        // Free FK so we can replace the tree safely.
        await tx.product.updateMany({ data: { categoryId: null } });
        await tx.catalogCategory.deleteMany({});

        // Two-phase insert so FK parent order never breaks inside a batch.
        const chunkSize = 250;
        for (let i = 0; i < categories.length; i += chunkSize) {
          const slice = categories.slice(i, i + chunkSize);
          await tx.catalogCategory.createMany({
            data: slice.map((row) => ({
              id: row.id,
              name: row.name,
              kind: row.kind,
              parentId: null,
              attributes: row.attributes,
            })),
          });
        }
        for (let i = 0; i < categories.length; i += chunkSize) {
          const slice = categories.slice(i, i + chunkSize).filter((row) => row.parentId);
          await Promise.all(
            slice.map((row) =>
              tx.catalogCategory.update({
                where: { id: row.id },
                data: { parentId: row.parentId },
              }),
            ),
          );
        }

        for (const row of remaps) {
          await tx.product.update({
            where: { id: row.id },
            data: {
              categoryId: row.categoryId,
              attributeValues: row.attributeValues === null ? undefined : row.attributeValues,
            },
          });
        }
      },
      { timeout: 600_000 },
    );

    console.log(
      `Catalog taxonomy loaded: ${categories.length} categories (${taxonomy.locale}, ${taxonomy.version}).`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
