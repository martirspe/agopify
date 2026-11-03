-- Align footwear category metafields with Shopify Admin “Sandalias / Calzado” attributes.

UPDATE "CatalogCategory" SET "attributes" = '[
  {"key":"color","name":"Color","group":"Variaciones","variant":true,"required":true,"values":["Negro","Blanco","Gris","Beige","Marrón","Azul","Rojo","Verde","Rosa","Dorado","Multicolor"]},
  {"key":"size","name":"Talla del calzado","group":"Variaciones","variant":true,"required":true,"values":["34","35","36","37","38","39","40","41","42","43","44","45","46"]},
  {"key":"footwear_material","name":"Material del calzado","group":"Composición","values":["Cuero","Sintético","Textil","Gamuza","Charol","Mixto"]},
  {"key":"closure","name":"Tipo de cierre","group":"Producto","values":["Cordones","Velcro","Cremallera","Hebillas","Sin cierre","Elástico","Deslizante"]},
  {"key":"heel_height","name":"Tipo de altura del tacón","group":"Producto","values":["Plano","Bajo","Medio","Alto","Plataforma"]},
  {"key":"sandal_style","name":"Estilo de sandalia","group":"Producto","values":["Correa al tobillo","Slide","Gladiador","Cuña","Cruzada","Dedo"]},
  {"key":"toe_style","name":"Estilo de punta del calzado","group":"Producto","values":["Abierto","Cerrado","Puntiagudo","Redondo","Cuadrado"]},
  {"key":"audience","name":"Sexo objetivo","group":"Público","values":["Femenino","Masculino","Unisex"]},
  {"key":"age_group","name":"Grupo de edad","group":"Público","values":["Adulto","Adolescente","Niño","Bebé"]},
  {"key":"care","name":"Instrucciones de cuidado","group":"Uso","maxLength":120},
  {"key":"lining","name":"Material del forro","group":"Composición","values":["Cuero","Sintético","Textil","Sin forro"]},
  {"key":"occasion","name":"Estilo de ocasión","group":"Uso","values":["Casual","Formal","Fiesta","Playa","Deporte","Trabajo"]},
  {"key":"outsole","name":"Material de la suela exterior","group":"Composición","values":["Goma","EVA","Cuero","TR","PU","Corcho"]},
  {"key":"features","name":"Características del zapato","group":"Producto","values":["Impermeable","Transpirable","Acolchado","Antideslizante","Ortopédico"]},
  {"key":"fit","name":"Ajuste del calzado","group":"Uso","values":["Ajuste regular","Ajuste estrecho","Ajuste amplio"]}
]'::jsonb
WHERE "id" = 'footwear';
