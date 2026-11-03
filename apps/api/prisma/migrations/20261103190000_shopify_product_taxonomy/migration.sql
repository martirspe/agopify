-- Replace legacy Agopify category stubs with Shopify Standard Product Taxonomy (es, v2025-12).
-- Category rows are loaded by `node scripts/load-catalog-taxonomy.mjs` (UTF-8 gzip JSON)
-- immediately after `prisma migrate deploy` in Docker and local workflows.
-- This migration only clears product links so the loader can rebuild the tree safely.

UPDATE "Product"
SET "categoryId" = NULL
WHERE "categoryId" IS NOT NULL;

DELETE FROM "CatalogCategory";
