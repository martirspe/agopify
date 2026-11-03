-- Enrich shared CatalogCategory metafields (Shopify-style curated entries per vertical).
-- Additive data update only; no schema change. Existing product attributeValues remain readable.

UPDATE "CatalogCategory" SET "attributes" = '[{"key":"material","name":"Tejido","group":"Composición","values":["Algodón","Poliéster","Lana","Lino","Seda","Cuero","Sintético","Mixto"]},{"key":"audience","name":"Género","group":"Público","values":["Mujer","Hombre","Unisex"]},{"key":"age_group","name":"Grupo de edad","group":"Público","values":["Adulto","Adolescente","Niño","Bebé"]}]'::jsonb
WHERE "id" = 'fashion';

UPDATE "CatalogCategory" SET "attributes" = '[{"key":"contents","name":"Contenido neto","group":"Presentación","maxLength":60},{"key":"skin_type","name":"Tipo de piel","group":"Uso","values":["Normal","Seca","Grasa","Mixta","Sensible","Todo tipo"]},{"key":"audience","name":"Género","group":"Público","values":["Mujer","Hombre","Unisex"]},{"key":"age_group","name":"Grupo de edad","group":"Público","values":["Adulto","Adolescente","Niño"]}]'::jsonb
WHERE "id" = 'beauty';

UPDATE "CatalogCategory" SET "attributes" = '[{"key":"model","name":"Modelo","group":"Identificación","variant":true,"maxLength":80},{"key":"capacity","name":"Capacidad","group":"Especificaciones","variant":true,"maxLength":40},{"key":"compatibility","name":"Compatibilidad","group":"Especificaciones","maxLength":120},{"key":"connectivity","name":"Conectividad","group":"Especificaciones","values":["Wi-Fi","Bluetooth","USB-C","Lightning","HDMI","Ethernet","Ninguna"]}]'::jsonb
WHERE "id" = 'electronics';

UPDATE "CatalogCategory" SET "attributes" = '[{"key":"material","name":"Material","group":"Composición","variant":true,"values":["Madera","Metal","Vidrio","Plástico","Tela","Cerámica","Mixto"]},{"key":"dimensions","name":"Dimensiones","group":"Presentación","maxLength":60},{"key":"color","name":"Color","group":"Variaciones","variant":true,"values":["Negro","Blanco","Gris","Beige","Marrón","Azul","Verde","Natural","Multicolor"]},{"key":"room","name":"Ambiente","group":"Uso","values":["Sala","Dormitorio","Cocina","Baño","Oficina","Exterior","Cualquiera"]}]'::jsonb
WHERE "id" = 'home';

UPDATE "CatalogCategory" SET "attributes" = '[{"key":"scope","name":"Alcance del servicio","group":"Servicio","required":true,"maxLength":200},{"key":"modality","name":"Modalidad","group":"Servicio","variant":true,"values":["En el local","A domicilio","En línea"]}]'::jsonb
WHERE "id" = 'services';

UPDATE "CatalogCategory" SET "attributes" = '[{"key":"format","name":"Formato","group":"Entrega","required":true,"values":["PDF","Video","Curso en línea","Plantilla","Audio","Software","Otro"]},{"key":"license","name":"Licencia","group":"Uso","variant":true,"values":["Uso personal","Uso comercial","Licencia de equipo","Suscripción"]}]'::jsonb
WHERE "id" = 'digital';

UPDATE "CatalogCategory" SET "attributes" = '[{"key":"color","name":"Color","group":"Variaciones","variant":true,"required":true,"values":["Negro","Blanco","Gris","Beige","Marrón","Azul","Rojo","Verde","Rosa","Multicolor"]},{"key":"size","name":"Talla","group":"Variaciones","variant":true,"required":true,"values":["34","35","36","37","38","39","40","41","42","43","44","45","46"]},{"key":"footwear_type","name":"Tipo de calzado","group":"Producto","values":["Zapatilla","Zapato formal","Bota","Sandalia","Mocasín","Chala","Pantufla"]},{"key":"sole","name":"Material de suela","group":"Composición","values":["Goma","EVA","Cuero","TR","PU","Corcho"]},{"key":"closure","name":"Cierre","group":"Producto","values":["Cordones","Velcro","Cremallera","Hebilla","Sin cierre","Elástico"]}]'::jsonb
WHERE "id" = 'footwear';

UPDATE "CatalogCategory" SET "attributes" = '[{"key":"sport","name":"Uso deportivo","group":"Uso","values":["Running","Training","Casual","Basket","Fútbol","Skate","Trail"]}]'::jsonb
WHERE "id" = 'sneakers';

UPDATE "CatalogCategory" SET "attributes" = '[{"key":"skin_concern","name":"Necesidad de la piel","group":"Uso","values":["Hidratación","Antiedad","Acné","Manchas","Poros","Calma","Luminosidad"]},{"key":"texture","name":"Textura","group":"Presentación","values":["Crema","Gel","Sérum","Loción","Aceite","Bálsamo","Espuma"]}]'::jsonb
WHERE "id" = 'skin_care';

UPDATE "CatalogCategory" SET "attributes" = '[{"key":"family","name":"Familia olfativa","group":"Fragancia","values":["Floral","Oriental","Amaderada","Cítrica","Fresca","Chipre","Fougère","Gourmand"]},{"key":"intensity","name":"Intensidad","group":"Fragancia","values":["Suave","Moderada","Intensa"]},{"key":"concentration","name":"Concentración","group":"Fragancia","values":["Eau de toilette","Eau de parfum","Parfum","Cologne","Body mist"]},{"key":"audience","name":"Género","group":"Público","values":["Mujer","Hombre","Unisex"]}]'::jsonb
WHERE "id" = 'fragrances';
