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
-- Category metafields follow Shopify Standard Product Taxonomy style: curated
-- entries per vertical; variant keys (color/size/…) connect to Variantes in console.
INSERT INTO "CatalogCategory" ("id", "name", "kind", "parentId", "attributes") VALUES
('fashion', 'Moda', 'PRODUCT', NULL, '[{"key":"material","name":"Tejido","group":"Composición","values":["Algodón","Poliéster","Lana","Lino","Seda","Cuero","Sintético","Mixto"]},{"key":"audience","name":"Género","group":"Público","values":["Mujer","Hombre","Unisex"]},{"key":"age_group","name":"Grupo de edad","group":"Público","values":["Adulto","Adolescente","Niño","Bebé"]}]'),
('beauty', 'Belleza y cuidado', 'PRODUCT', NULL, '[{"key":"contents","name":"Contenido neto","group":"Presentación","maxLength":60},{"key":"skin_type","name":"Tipo de piel","group":"Uso","values":["Normal","Seca","Grasa","Mixta","Sensible","Todo tipo"]},{"key":"audience","name":"Género","group":"Público","values":["Mujer","Hombre","Unisex"]},{"key":"age_group","name":"Grupo de edad","group":"Público","values":["Adulto","Adolescente","Niño"]}]'),
('electronics', 'Electrónica', 'PRODUCT', NULL, '[{"key":"model","name":"Modelo","group":"Identificación","variant":true,"maxLength":80},{"key":"capacity","name":"Capacidad","group":"Especificaciones","variant":true,"maxLength":40},{"key":"compatibility","name":"Compatibilidad","group":"Especificaciones","maxLength":120},{"key":"connectivity","name":"Conectividad","group":"Especificaciones","values":["Wi-Fi","Bluetooth","USB-C","Lightning","HDMI","Ethernet","Ninguna"]}]'),
('home', 'Hogar', 'PRODUCT', NULL, '[{"key":"material","name":"Material","group":"Composición","variant":true,"values":["Madera","Metal","Vidrio","Plástico","Tela","Cerámica","Mixto"]},{"key":"dimensions","name":"Dimensiones","group":"Presentación","maxLength":60},{"key":"color","name":"Color","group":"Variaciones","variant":true,"values":["Negro","Blanco","Gris","Beige","Marrón","Azul","Verde","Natural","Multicolor"]},{"key":"room","name":"Ambiente","group":"Uso","values":["Sala","Dormitorio","Cocina","Baño","Oficina","Exterior","Cualquiera"]}]'),
('services', 'Servicios', 'SERVICE', NULL, '[{"key":"scope","name":"Alcance del servicio","group":"Servicio","required":true,"maxLength":200},{"key":"modality","name":"Modalidad","group":"Servicio","variant":true,"values":["En el local","A domicilio","En línea"]}]'),
('digital', 'Contenido digital', 'DIGITAL', NULL, '[{"key":"format","name":"Formato","group":"Entrega","required":true,"values":["PDF","Video","Curso en línea","Plantilla","Audio","Software","Otro"]},{"key":"license","name":"Licencia","group":"Uso","variant":true,"values":["Uso personal","Uso comercial","Licencia de equipo","Suscripción"]}]'),
('footwear', 'Calzado', 'PRODUCT', 'fashion', '[{"key":"color","name":"Color","group":"Variaciones","variant":true,"required":true,"values":["Negro","Blanco","Gris","Beige","Marrón","Azul","Rojo","Verde","Rosa","Dorado","Multicolor"]},{"key":"size","name":"Talla del calzado","group":"Variaciones","variant":true,"required":true,"values":["34","35","36","37","38","39","40","41","42","43","44","45","46"]},{"key":"footwear_material","name":"Material del calzado","group":"Composición","values":["Cuero","Sintético","Textil","Gamuza","Charol","Mixto"]},{"key":"closure","name":"Tipo de cierre","group":"Producto","values":["Cordones","Velcro","Cremallera","Hebillas","Sin cierre","Elástico","Deslizante"]},{"key":"heel_height","name":"Tipo de altura del tacón","group":"Producto","values":["Plano","Bajo","Medio","Alto","Plataforma"]},{"key":"sandal_style","name":"Estilo de sandalia","group":"Producto","values":["Correa al tobillo","Slide","Gladiador","Cuña","Cruzada","Dedo"]},{"key":"toe_style","name":"Estilo de punta del calzado","group":"Producto","values":["Abierto","Cerrado","Puntiagudo","Redondo","Cuadrado"]},{"key":"audience","name":"Sexo objetivo","group":"Público","values":["Femenino","Masculino","Unisex"]},{"key":"age_group","name":"Grupo de edad","group":"Público","values":["Adulto","Adolescente","Niño","Bebé"]},{"key":"care","name":"Instrucciones de cuidado","group":"Uso","maxLength":120},{"key":"lining","name":"Material del forro","group":"Composición","values":["Cuero","Sintético","Textil","Sin forro"]},{"key":"occasion","name":"Estilo de ocasión","group":"Uso","values":["Casual","Formal","Fiesta","Playa","Deporte","Trabajo"]},{"key":"outsole","name":"Material de la suela exterior","group":"Composición","values":["Goma","EVA","Cuero","TR","PU","Corcho"]},{"key":"features","name":"Características del zapato","group":"Producto","values":["Impermeable","Transpirable","Acolchado","Antideslizante","Ortopédico"]},{"key":"fit","name":"Ajuste del calzado","group":"Uso","values":["Ajuste regular","Ajuste estrecho","Ajuste amplio"]}]'),
('sneakers', 'Zapatillas', 'PRODUCT', 'footwear', '[{"key":"sport","name":"Uso deportivo","group":"Uso","values":["Running","Training","Casual","Basket","Fútbol","Skate","Trail"]}]'),
('sandals', 'Sandalias', 'PRODUCT', 'footwear', '[]'),
('skin_care', 'Cuidado facial', 'PRODUCT', 'beauty', '[{"key":"skin_concern","name":"Necesidad de la piel","group":"Uso","values":["Hidratación","Antiedad","Acné","Manchas","Poros","Calma","Luminosidad"]},{"key":"texture","name":"Textura","group":"Presentación","values":["Crema","Gel","Sérum","Loción","Aceite","Bálsamo","Espuma"]}]'),
('creams', 'Cremas', 'PRODUCT', 'skin_care', '[]'),
('fragrances', 'Fragancias', 'PRODUCT', 'beauty', '[{"key":"family","name":"Familia olfativa","group":"Fragancia","values":["Floral","Oriental","Amaderada","Cítrica","Fresca","Chipre","Fougère","Gourmand"]},{"key":"intensity","name":"Intensidad","group":"Fragancia","values":["Suave","Moderada","Intensa"]},{"key":"concentration","name":"Concentración","group":"Fragancia","values":["Eau de toilette","Eau de parfum","Parfum","Cologne","Body mist"]},{"key":"audience","name":"Género","group":"Público","values":["Mujer","Hombre","Unisex"]}]');
