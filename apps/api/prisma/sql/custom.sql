-- Custom Postgres objects that Prisma schema does not emit.
-- Appended to migrations/0001_init/migration.sql (first-deploy only; empty database).

-- Full-text search over catalog fields (never indexes private digital URLs/instructions).
CREATE FUNCTION catalog_search_document(text, text, text, text[], text, text, jsonb)
RETURNS tsvector LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT
    setweight(to_tsvector('spanish', translate(lower(coalesce($1, '') || ' ' || coalesce($7->'keywords', '[]')::text),
      'áéíóúüñ', 'aeiouun')), 'A') ||
    setweight(to_tsvector('spanish', translate(lower(coalesce($2, '') || ' ' || coalesce($3, '') || ' ' ||
      coalesce(array_to_string($4, ' '), '') || ' ' || coalesce($5, '')), 'áéíóúüñ', 'aeiouun')), 'B') ||
    setweight(to_tsvector('spanish', translate(lower(coalesce($6, '') || ' ' || coalesce($7, '{}')::text),
      'áéíóúüñ', 'aeiouun')), 'C');
$$;

CREATE INDEX "Product_catalog_search_idx" ON "Product" USING GIN
  (catalog_search_document(name, brand, line, categories, "descriptionShort", "descriptionFull", details));

-- Search outbox: catalog/FAQ writes enqueue embedding jobs in the same transaction.
CREATE FUNCTION sales_search_enqueue() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE doc RECORD; owner TEXT; source TEXT; kind TEXT; previous JSONB; current_doc JSONB;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    previous := to_jsonb(OLD); current_doc := to_jsonb(NEW);
    IF TG_TABLE_NAME = 'Product' THEN
      IF (previous->'name', previous->'brand', previous->'line', previous->'categories', previous->'descriptionShort', previous->'descriptionFull', previous->'details', previous->'isAvailable')
        IS NOT DISTINCT FROM
        (current_doc->'name', current_doc->'brand', current_doc->'line', current_doc->'categories', current_doc->'descriptionShort', current_doc->'descriptionFull', current_doc->'details', current_doc->'isAvailable') THEN RETURN NULL; END IF;
    ELSIF TG_TABLE_NAME = 'ProductVariant' THEN
      IF (previous->'option1Value', previous->'option2Value', previous->'option3Value', previous->'isAvailable')
        IS NOT DISTINCT FROM
        (current_doc->'option1Value', current_doc->'option2Value', current_doc->'option3Value', current_doc->'isAvailable') THEN RETURN NULL; END IF;
    ELSIF TG_TABLE_NAME = 'KnowledgeFaq' THEN
      IF (previous->'question', previous->'answer', previous->'tags', previous->'topic', previous->'reviewStatus', previous->'isPublished')
        IS NOT DISTINCT FROM
        (current_doc->'question', current_doc->'answer', current_doc->'tags', current_doc->'topic', current_doc->'reviewStatus', current_doc->'isPublished') THEN RETURN NULL; END IF;
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN doc := OLD; ELSE doc := NEW; END IF;
  IF TG_TABLE_NAME = 'ProductVariant' THEN
    SELECT "tenantId" INTO owner FROM "Product" WHERE id = doc."productId";
    source := doc."productId"; kind := 'product';
  ELSE
    owner := doc."tenantId"; source := doc.id;
    kind := CASE WHEN TG_TABLE_NAME = 'Product' THEN 'product' ELSE 'faq' END;
  END IF;
  IF owner IS NOT NULL AND EXISTS (SELECT 1 FROM "Tenant" WHERE id = owner) THEN
    INSERT INTO "SalesSearchJob" (id, "tenantId", "sourceId", "documentType", "updatedAt")
    VALUES (md5(owner || '/' || kind || '/' || source), owner, source, kind, CURRENT_TIMESTAMP)
    ON CONFLICT ("tenantId", "documentType", "sourceId") DO UPDATE
      SET revision = "SalesSearchJob".revision + 1, attempts = 0,
          "availableAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP;
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER sales_product_search AFTER INSERT OR UPDATE OR DELETE ON "Product"
  FOR EACH ROW EXECUTE FUNCTION sales_search_enqueue();
CREATE TRIGGER sales_variant_search AFTER INSERT OR UPDATE OR DELETE ON "ProductVariant"
  FOR EACH ROW EXECUTE FUNCTION sales_search_enqueue();
CREATE TRIGGER sales_faq_search AFTER INSERT OR UPDATE OR DELETE ON "KnowledgeFaq"
  FOR EACH ROW EXECUTE FUNCTION sales_search_enqueue();

-- Shared product classification tree (store/agent free-text categories remain independent).
INSERT INTO "CatalogCategory" ("id", "name", "kind", "parentId", "attributes") VALUES
('fashion', 'Moda', 'PRODUCT', NULL, '[{"key":"material","name":"Material","group":"Composición","variant":true},{"key":"audience","name":"Público","group":"Uso"}]'),
('beauty', 'Belleza y cuidado', 'PRODUCT', NULL, '[{"key":"contents","name":"Contenido neto","group":"Presentación","maxLength":60},{"key":"skin_type","name":"Tipo de piel","group":"Uso"}]'),
('electronics', 'Electrónica', 'PRODUCT', NULL, '[{"key":"model","name":"Modelo","variant":true},{"key":"capacity","name":"Capacidad","variant":true},{"key":"compatibility","name":"Compatibilidad"}]'),
('home', 'Hogar', 'PRODUCT', NULL, '[{"key":"material","name":"Material","variant":true},{"key":"dimensions","name":"Dimensiones"},{"key":"color","name":"Color","variant":true}]'),
('services', 'Servicios', 'SERVICE', NULL, '[{"key":"scope","name":"Alcance del servicio","required":true},{"key":"modality","name":"Modalidad","variant":true}]'),
('digital', 'Contenido digital', 'DIGITAL', NULL, '[{"key":"format","name":"Formato","required":true},{"key":"license","name":"Licencia","variant":true}]'),
('footwear', 'Calzado', 'PRODUCT', 'fashion', '[{"key":"color","name":"Color","group":"Variaciones","variant":true,"required":true},{"key":"size","name":"Talla","group":"Variaciones","variant":true,"required":true},{"key":"sole","name":"Material de suela","group":"Composición"},{"key":"footwear_type","name":"Tipo de calzado","group":"Uso"}]'),
('sneakers', 'Zapatillas', 'PRODUCT', 'footwear', '[]'),
('skin_care', 'Cuidado facial', 'PRODUCT', 'beauty', '[]'),
('creams', 'Cremas', 'PRODUCT', 'skin_care', '[]'),
('fragrances', 'Fragancias', 'PRODUCT', 'beauty', '[{"key":"family","name":"Familia olfativa","group":"Fragancia"},{"key":"intensity","name":"Intensidad","group":"Fragancia"}]');
