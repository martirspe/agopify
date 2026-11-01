-- Product lifecycle, per-channel listings, option axes and merchant collections.

CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
CREATE TYPE "ProductChannelKind" AS ENUM ('STORE', 'WHATSAPP', 'INSTAGRAM');

ALTER TABLE "Product" ADD COLUMN "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT';

UPDATE "Product"
SET "status" = CASE
  WHEN "isAvailable" = true THEN 'ACTIVE'::"ProductStatus"
  WHEN "isPublishedOnStore" = true THEN 'ACTIVE'::"ProductStatus"
  ELSE 'DRAFT'::"ProductStatus"
END;

CREATE TABLE "ProductOption" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "values" JSONB NOT NULL,
    CONSTRAINT "ProductOption_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductChannelListing" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "channel" "ProductChannelKind" NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    CONSTRAINT "ProductChannelListing_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Collection" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CollectionProduct" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "CollectionProduct_pkey" PRIMARY KEY ("id")
);

-- Channel listings from legacy flags.
INSERT INTO "ProductChannelListing" ("id", "productId", "channel", "isPublished", "publishedAt")
SELECT
  md5(p."id" || ':STORE'),
  p."id",
  'STORE'::"ProductChannelKind",
  p."isPublishedOnStore",
  CASE WHEN p."isPublishedOnStore" THEN p."updatedAt" ELSE NULL END
FROM "Product" p
WHERE p."isPublishedOnStore" = true;

INSERT INTO "ProductChannelListing" ("id", "productId", "channel", "isPublished", "publishedAt")
SELECT
  md5(p."id" || ':WHATSAPP'),
  p."id",
  'WHATSAPP'::"ProductChannelKind",
  true,
  p."updatedAt"
FROM "Product" p
WHERE p."isAvailable" = true;

INSERT INTO "ProductChannelListing" ("id", "productId", "channel", "isPublished", "publishedAt")
SELECT
  md5(p."id" || ':INSTAGRAM'),
  p."id",
  'INSTAGRAM'::"ProductChannelKind",
  true,
  p."updatedAt"
FROM "Product" p
WHERE p."isAvailable" = true;

-- Option axes from variant option pairs (JSON or legacy columns).
WITH pairs AS (
  SELECT
    v."productId",
    COALESCE(NULLIF(trim(pair->>'name'), ''), 'Opción') AS "name",
    trim(pair->>'value') AS "value",
    ord.ordinality::int AS "axis_pos"
  FROM "ProductVariant" v
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE
      WHEN v."options" IS NOT NULL AND jsonb_typeof(v."options"::jsonb) = 'array' THEN v."options"::jsonb
      ELSE (
        SELECT COALESCE(jsonb_agg(x), '[]'::jsonb)
        FROM (
          SELECT jsonb_build_object('name', COALESCE(v."option1Name", 'Opción'), 'value', v."option1Value") AS x
          WHERE v."option1Value" IS NOT NULL AND trim(v."option1Value") <> ''
          UNION ALL
          SELECT jsonb_build_object('name', COALESCE(v."option2Name", 'Opción'), 'value', v."option2Value")
          WHERE v."option2Value" IS NOT NULL AND trim(v."option2Value") <> ''
          UNION ALL
          SELECT jsonb_build_object('name', COALESCE(v."option3Name", 'Opción'), 'value', v."option3Value")
          WHERE v."option3Value" IS NOT NULL AND trim(v."option3Value") <> ''
        ) s
      )
    END
  ) WITH ORDINALITY AS ord(pair, ordinality)
  WHERE jsonb_typeof(pair) = 'object'
    AND coalesce(trim(pair->>'value'), '') <> ''
),
axes AS (
  SELECT
    "productId",
    "name",
    MIN("axis_pos") AS "position",
    jsonb_agg(DISTINCT "value" ORDER BY "value") AS "values"
  FROM pairs
  GROUP BY "productId", "name"
)
INSERT INTO "ProductOption" ("id", "productId", "name", "position", "values")
SELECT
  md5(a."productId" || ':' || lower(a."name")),
  a."productId",
  a."name",
  ROW_NUMBER() OVER (PARTITION BY a."productId" ORDER BY a."position", a."name") - 1,
  a."values"
FROM axes a;

-- Collections from distinct category labels.
WITH labels AS (
  SELECT DISTINCT p."tenantId", trim(cat) AS "title"
  FROM "Product" p
  CROSS JOIN LATERAL unnest(p."categories") AS cat
  WHERE trim(cat) <> ''
),
prepared AS (
  SELECT
    "tenantId",
    "title",
    lower(regexp_replace(regexp_replace(trim("title"), '[^\w]+', '-', 'g'), '(^-+|-+$)', '', 'g')) AS "base_handle"
  FROM labels
),
dedup AS (
  SELECT
    "tenantId",
    "title",
    CASE
      WHEN "base_handle" = '' OR "base_handle" IS NULL THEN 'coleccion'
      ELSE "base_handle"
    END AS "base_handle",
    ROW_NUMBER() OVER (
      PARTITION BY "tenantId",
        CASE WHEN "base_handle" = '' OR "base_handle" IS NULL THEN 'coleccion' ELSE "base_handle" END
      ORDER BY "title"
    ) AS "rn"
  FROM prepared
)
INSERT INTO "Collection" ("id", "tenantId", "handle", "title", "description", "sortOrder", "isPublished", "createdAt", "updatedAt")
SELECT
  md5(d."tenantId" || ':' || d."title"),
  d."tenantId",
  CASE WHEN d."rn" = 1 THEN d."base_handle" ELSE d."base_handle" || '-' || d."rn"::text END,
  d."title",
  NULL,
  0,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM dedup d;

INSERT INTO "CollectionProduct" ("id", "collectionId", "productId", "sortOrder")
SELECT DISTINCT
  md5(c."id" || ':' || p."id"),
  c."id",
  p."id",
  0
FROM "Product" p
JOIN "Collection" c ON c."tenantId" = p."tenantId"
CROSS JOIN LATERAL unnest(p."categories") AS cat
WHERE trim(cat) = c."title";

-- Refresh denormalized titles from memberships (stable order by collection title).
UPDATE "Product" p
SET "categories" = COALESCE((
  SELECT array_agg(c."title" ORDER BY c."title")
  FROM "CollectionProduct" cp
  JOIN "Collection" c ON c."id" = cp."collectionId"
  WHERE cp."productId" = p."id"
), ARRAY[]::text[]);

DROP INDEX IF EXISTS "Product_tenantId_isPublishedOnStore_idx";
DROP INDEX IF EXISTS "Product_tenantId_isAvailable_sortOrder_updatedAt_idx";

ALTER TABLE "Product" DROP COLUMN "isAvailable";
ALTER TABLE "Product" DROP COLUMN "isPublishedOnStore";

CREATE INDEX "Product_tenantId_status_sortOrder_updatedAt_idx" ON "Product"("tenantId", "status", "sortOrder", "updatedAt");

CREATE UNIQUE INDEX "ProductOption_productId_name_key" ON "ProductOption"("productId", "name");
CREATE INDEX "ProductOption_productId_position_idx" ON "ProductOption"("productId", "position");

CREATE UNIQUE INDEX "ProductChannelListing_productId_channel_key" ON "ProductChannelListing"("productId", "channel");
CREATE INDEX "ProductChannelListing_productId_isPublished_idx" ON "ProductChannelListing"("productId", "isPublished");
CREATE INDEX "ProductChannelListing_channel_isPublished_idx" ON "ProductChannelListing"("channel", "isPublished");

CREATE UNIQUE INDEX "Collection_tenantId_handle_key" ON "Collection"("tenantId", "handle");
CREATE INDEX "Collection_tenantId_isPublished_sortOrder_idx" ON "Collection"("tenantId", "isPublished", "sortOrder");

CREATE UNIQUE INDEX "CollectionProduct_collectionId_productId_key" ON "CollectionProduct"("collectionId", "productId");
CREATE INDEX "CollectionProduct_productId_idx" ON "CollectionProduct"("productId");

ALTER TABLE "ProductOption" ADD CONSTRAINT "ProductOption_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductChannelListing" ADD CONSTRAINT "ProductChannelListing_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CollectionProduct" ADD CONSTRAINT "CollectionProduct_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CollectionProduct" ADD CONSTRAINT "CollectionProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
