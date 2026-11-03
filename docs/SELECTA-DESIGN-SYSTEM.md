# Selecta — sistema de diseño

Selecta comparte una identidad visual desde inicio hasta confirmación y documentos legales. Las páginas deciden su composición; no definen nuevas fuentes, paletas, tamaños de controles o tarjetas. La fuente ejecutable es `packages/design-tokens/selecta.scss` junto con `apps/store/src/app/templates/selecta/_selecta-system.scss`.

## Responsabilidad de cada capa

| Capa | Fuente | Responsabilidad |
| --- | --- | --- |
| Escala de plataforma | `packages/design-tokens/storefront.scss` | Tipografía, espaciado, interacción y contratos compartidos de las tiendas. |
| Identidad Selecta | `packages/design-tokens/selecta.scss` | Adaptar colores, fuentes, fotografía, nombres y precios de tarjetas a tokens semánticos. |
| Componentes de Selecta | `_selecta-system.scss` | Reglas comunes para títulos, tarjetas, botones, campos, precios, foco y superficies. |
| Composición | `_selecta-layout.scss`, `_selecta-editorial.scss` | Rejillas, anchos, orden, hero, campaña y adaptación móvil. No redefinir la apariencia base de los componentes. |
| Personalización | `StoreThemeTokens` y `SelectaShell` | Aplicar colores, fuentes, contenedor y esquinas del negocio. Los valores del editor conservan prioridad. |

## Matriz de roles

| Rol | Contrato |
| --- | --- |
| Texto | `--store-font-body`: fuente del negocio; `--store-type-body` y `--store-leading-body` para lectura. |
| Títulos | `--store-font-display`: fuente editorial del negocio. Hero, página, sección y producto usan los respectivos `--store-type-*`. |
| Producto en tarjeta | `--store-card-name-font/size/weight`, compartidos por inicio y tienda. Sin fuente sans distinta en el catálogo. |
| Precio en tarjeta | `--store-card-price-size`, peso 600, números tabulares; moneda y cifras conservan el contrato comercial. |
| Imagen de tarjeta | `--store-media-ratio` 4:5, `cover` a sangrado (`--store-card-media-padding: 0`), fondo `--store-surface` y radio de tarjeta (`--ds-radius-sm` por defecto). La tarjeta destacada del inicio puede cambiar la composición del marco en móvil. |
| Acción principal | `.button`, `.store-btn`, `.card-cta`: mismo alto, fuente, borde, radio de control y color de marca; sin píldoras sueltas por ruta. |
| Acción secundaria | `.button.secondary`, `.store-btn--secondary`: fondo transparente y borde semántico. Acciones de texto usan el color de marca. |
| Campos | Fuente de cuerpo, fondo `--store-bg`, borde y radio semánticos. Búsqueda, compra y selectores comparten altura de control. Checkbox/radio conservan su contrato nativo. |
| Superficie | `--store-bg` para página; `--store-surface` para fotografía y agrupaciones; `--store-border` para divisiones. |
| Estados | Foco visible, disabled nativo, errores legibles y movimiento reducido. Ninguna interacción depende solo de hover. |
| Responsive | Roles constantes; cambia la composición. Nombre de tarjeta pasa al tamaño de subtítulo en móvil, con el mismo token para inicio y tienda. |

## Regla para cada mejora

1. Consultar esta matriz y la DSM general antes de añadir estilos.
2. Reutilizar el rol existente y su token. Ajustar la composición en el archivo de layout correspondiente.
3. Si un rol falta, definir su contrato y consumidores en la capa común; no introducir una excepción por ruta.
4. Verificar el mismo producto en inicio y tienda, luego ficha, bolsa, pago, confirmación y legal. Comparar fuente, precio, imagen, acción, campos y foco en escritorio y móvil.
5. Respetar las diferencias funcionales: inicio editorial acotado; tienda con filtros; compra con un resumen claro. Compartir apariencia no exige repetir la misma composición.

No cambiar lógica comercial para uniformar una presentación. Mantener contenido editable, secciones ocultas y ajustes explícitos del merchant. Registrar la evidencia real; compilación y mediciones del DOM no equivalen a revisión visual.
