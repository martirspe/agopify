-- Shopify Admin leaf under Calzado: “Sandalias en Calzado” (inherits footwear metafields).
INSERT INTO "CatalogCategory" ("id", "name", "kind", "parentId", "attributes")
VALUES ('sandals', 'Sandalias', 'PRODUCT', 'footwear', '[]'::jsonb)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "kind" = EXCLUDED."kind",
  "parentId" = EXCLUDED."parentId";
