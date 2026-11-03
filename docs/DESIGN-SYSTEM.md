# Agopify — Design System Matrix

Esta es la matriz de implementación de la consola. El código de `packages/design-tokens` y `packages/ui` define los valores y contratos ejecutables. `PROJECT CONSTITUTION.md` define el branding; `UX-UI-MASTER-SYSTEM.md`, sección 75, contiene el protocolo UX/UI aportado por el usuario. No leer documentos completos para un cambio puntual: consultar las filas afectadas.

## Fundamentos

### Storefront · Rosaline · Bold Modern

Tema independiente `agopify/rosaline`, renderer `rosaline@1`: [matriz, contratos y auditoría](ROSALINE-DESIGN-SYSTEM.md). Fundamentos aislados en `packages/design-tokens/rosaline.scss`, tipografías Anton/Geist locales, recursos limitados a la demo y estilos bajo `body.tpl-rosaline .ro-shell`. Reutiliza estado comercial y controles del motor; no componentes visuales de Selecta/Impulso. Licencia comercial y derechos de imágenes pendientes antes de distribuir a terceros.

### Storefront · Selecta · Bolsa

Sistema transversal de Selecta: [matriz y gobierno](SELECTA-DESIGN-SYSTEM.md). Tokens de identidad en `packages/design-tokens/selecta.scss`; roles de componentes en `_selecta-system.scss`. Inicio y tienda comparten fuente/tamaño del producto, precio, fotografía y acciones; layouts editoriales solo definen composición.

Inicio de Selecta: portada editorial, navegación visual por hasta seis categorías y una selección acotada a tres productos del catálogo cargado. No ofrece filtros ni carga incremental; los accesos llevan a `/tienda`, que reutiliza búsqueda, facetas, categorías, ordenación, cuadrícula/lista y paginación. En móvil, el primer producto ocupa el ancho de la selección y los siguientes forman dos columnas. La composición `collection` y sus textos editables se conservan.

Anchos de Selecta: hero, cabecera y campaña editorial ocupan la pantalla. El contenido usa `--store-theme-width-wide` (1440 px) por defecto; la elección de contenedor del editor conserva prioridad. Ficha y compra limitan ese ancho mediante `--store-product-max-width` (1280 px) y `--store-commerce-max-width` (1200 px). Márgenes laterales derivados de `--ds-gutter`; texto del hero alineado al catálogo y footer con fondo completo.

Selecta también compone el inicio mediante `_selecta-editorial.scss`: fotografía panorámica con panel superpuesto y contraste derivado del color del merchant; a 600 px, fotografía sobre el panel. Colección de cuatro/tres/dos columnas (escritorio/tablet/móvil), fotos contenidas en un marco 4:5 y acción siempre visible. Bloque editorial asimétrico, ficha con galería y jerarquía de precio y pie legal en columnas. Tokens y contratos de edición existentes; sin nuevas fuentes, dependencias o reglas comerciales.

| Patrón | Contrato vigente |
| --- | --- |
| Identidad y composición | Selecta conserva la tipografía editorial y la paleta del merchant. `_selecta-layout.scss` compone selección y resumen lateral; a 900 px pasa a una columna y a 600 px reorganiza los subtotales bajo la información del producto. |
| Tokens | Tipografía `--store-type-*`, ritmo `--ds-space-*`, superficie `--store-surface`, miniaturas derivadas de `--store-recommendation-thumb` y ancho lateral `--store-summary-width`. Sin nuevas escalas ni componentes comerciales duplicados. |
| Producto y cantidades | Foto contenida, nombre enlazado, variante, precio unitario y subtotal. Grupo de cantidad con nombre por producto, botones táctiles, cantidad anunciada y retirada explícita. |
| Resumen y estados | Subtotal anunciado, costes pendientes explícitos y una acción principal. Selección inválida usa un botón nativo deshabilitado y explicación; bolsa vacía enlaza al catálogo. Las recomendaciones quedan después del área de compra. No cambia precios, inventario, checkout ni contratos del editor. |

### Plataforma

| Categoría | Fuente y decisión vigente |
| --- | --- |
| Marca | Primario de marca `#C8F542` e ink `#0B0D12` en marketing, tienda y consola. La consola usa chrome propio (rail oscuro, frame blanco) sin adoptar verdes de terceros. |
| Superficies y contenido | `bg`, `surface`, `surface-elevated`, `text-primary`, `text-secondary`, `border`, `divider`. Consola: canvas `#f1f1f1`, border `#e3e3e3`, sidebar `#ebebeb`. Features consumen nombres semánticos. |
| Feedback | `success`, `warning`, `danger`, `info` para fondo/señal; sus variantes `*-text` para textos legibles. `ds-banner` para avisos de página con tono y acción. |
| Foco y disabled | `focus-ring`, `disabled`, `overlay`; foco visible en teclado. Disabled conserva contexto y bloquea la operación. Overlay de modal: `--ds-color-overlay` + `--ds-overlay-blur` (8 px) en `modal-frame::backdrop`; se desactiva con `prefers-reduced-transparency`. |
| Tipografía | Marketing: Manrope UI / Satoshi display. Consola: Inter self-hosted. `type-caption` 12 px, `type-sm` 14 px, `type-lg` 18 px y `type-page` adaptable. Tablas e importes: números tabulares. |
| Espaciado | `space-1/2/3/4/5/6/8/10/12`: escala de 4 a 48 px. Formularios: separación habitual 16 px, grupos 12 px, etiqueta/campo 8 px. |
| Tamaños | `touch-target` 44 px en móvil/táctil; densidad de consola de escritorio definida por `console-control-height` (36 px). `console-form-width`, `console-page-width` y anchos de navegación son tokens existentes. |
| Forma | Consola: radios (`radius-sm` 8 px); cards 20 px con hairline suave (sin borde tinta); campos 12 px + ring quieto; `console-choice` para tiles seleccionables. Pastillas 28 px solo en cabecera. |
| Elevación | Cards planas con borde; `shadow-sm` mínimo; `shadow-dropdown` para overlays. CTA dock a ancho completo; guardado contextual de editores usa cápsula flotante (`layout="capsule"`). |
| Movimiento | `motion-fast/base` y `ease-out`; respetar reduced motion. Movimiento solo para interacción, no para decoración persistente. |
| Responsive | Tailwind usa los breakpoints instalados y el breakpoint `console` existente. 40 rem para composición estrecha y 64 rem para el layout principal/lateral de Envíos. CSS de layout local permitido; nuevas escalas visuales locales no. Storefront: `--store-safe-*`, `--store-mobile-sticky-height`, `--store-mobile-fab-offset` y `--store-mobile-panel-padding` para safe areas, barras fijas y paneles compactos; no inventar offsets por plantilla. |
| Capas | Sticky: `--ds-z-sticky`. Dropdowns/dialogs existentes usan popover/dialog del navegador y su top layer. No inventar índices por feature; la normalización de capas de estilos heredados sigue pendiente. |

## Componentes y contratos

Todos se exportan desde `@agopify/ui`, son standalone y OnPush. Ninguno decide permisos, precios, guardado ni navegación comercial.

| Categoría | Componente/patrón | Contrato y estados |
| --- | --- | --- |
| Acción | `ds-button` | `variant`: primary/secondary/ghost/danger; `type`, `disabled`, `block`, `label`; `form` opcional asocia el botón nativo a un formulario por ID cuando la acción general está fuera de él. Contenido proyectado para texto e íconos. Foco visible, disabled y hover; el consumidor aporta el estado de operación. |
| Navegación con CTA | `a[dsLink]` | Enlace nativo con `href` o RouterLink y `variant`: primary/secondary/ghost. Comparte estilos y tokens de ds-button, sin botones anidados. Conserva apertura en otra pestaña y semántica de navegación; el consumidor aporta destino y texto accesible. |
| Selección de acción | `ds-button` con `pressed` | Estado booleano opcional para aria-pressed en el botón nativo; usado por la demo comercial. No convierte el botón en un tab ni añade navegación de teclado distinta de la nativa. |
| Ícono | `ds-icon` | `name` tipado por registro, `size`; solo Lucide y marcas oficiales existentes. Íconos decorativos acompañan texto; acciones de solo ícono necesitan nombre accesible. |
| Dropdown | `ds-select` | Proyecta un `select` nativo con sus opciones/formControl. Mejora progresiva a combobox/listbox en escritorio, búsqueda por teclado, Escape, foco, selección y opciones disabled. Panel ≥ trigger y crece al label (sin partir palabras; ellipsis solo si el viewport lo obliga). Fallback nativo en móvil/SSR. |
| Menú/panel | `ds-menu` | `mode`: menu (predeterminado, acciones con navegación de teclado) / panel (popover no modal con role dialog para campos y controles proyectados). Panel conserva teclado nativo y Tab; Escape/cierre explícito devuelve foco, salir con Tab cierra sin capturar foco. Foco inicial, límites del viewport y top layer nativo. Usar `ds-select` dentro del panel para valores; no presentar campos como menuitems. |
| Interruptor / checkbox | `ds-checkbox` y `_checkbox-control.scss` | Interruptor Admin Next (Preferencias): pista 32×16, thumb 12/inset 2, off `#dddddd` / on `#101010`, thumb blanco plano; track+thumb separados. `variant`: panel (fila, switch a la derecha) / inline. Nativos en `.tw:console-scope` iguales; auth/tienda conservan casilla. Conserva FormControl y estados nativos. |
| Elección de acción | `ds-choice-card` | Botón nativo con `title`, `description` e `icon` requeridos, `disabled` opcional, `density`: comfortable (predeterminado) / compact (bibliotecas laterales), y salida `activate`. Para elegir un flujo concreto en vacío o diálogo; no representa selección persistente ni reemplaza checkboxes. Icono neutro, flecha de avance, foco visible, teclado nativo y altura mínima táctil. Tokens de superficie/borde/texto/espaciado compartidos; se apila según el contenedor. Consumido por Descuentos y biblioteca del editor de Tienda. |
| Sección/tarjeta | `ds-form-section` | `title` requerido, `description`, `icon`, `variant`: panel/plain; `density`: comfortable (predeterminado) / compact. Panel = card Admin Next (radio 20 px, sombra anillo, padding 16 px, título 13/500, descripción 13/400, ícono 20 sin tile). Compact reduce padding/gaps. Header + cuerpo + `[dsSectionActions]`. Plain sin chrome. Planes consume compact. |
| Cabecera de página | `ds-page-header` | Sticky 52×full-bleed (Admin `.page-header`): toolbar 28 px (`padding 0 4px 0 16px`), título 13 px/500/lh 28. Índice: icono 20 + título + `[dsPageActions]`. Anidado/detalle: back circular 28 (fill blanco + anillo suave), icono + `parentTitle` crumb, `/`, título actual; `backHref`/`parentHref` o salida `back`. `description` fuera de la franja. Borde solo al scroll (`dsStickyEdge`). |
| Borde al scroll | `dsStickyEdge` | Directiva: sonda + `IntersectionObserver` del scrollport; clase `ds-sticky-edge--scrolled` para mostrar el divider solo fuera del top. |
| Aviso de página | `ds-banner` | `tone`: info/success/warning/critical; `title` opcional; cuerpo proyectado; slot `[dsBannerAction]`. Borde izquierdo tonal; no sustituye toasts de operación. |
| Filtros de índice | `console-filter-bar` (+ `console-filter-search`, `console-filter-chip`) | Franja con búsqueda y chips; `console-filter-search` = un solo ring suave + input desnudo (nunca anidar `console-field`); clear real del consumidor. Índice Productos: un solo «Buscar y filtrar» con chips inline + popover de dimensiones (sin selects sueltos). No inventar filtros sin backend/URL. |
| Tabla índice | `console-index-table`, `console-data-row` | Panel con cabecera densa, filas y acciones; en móvil lista/cards del consumidor. `console-list-panel`, `console-metric`, `console-list-skeleton` siguen vigentes. |
| FAQ/detalle opcional | `ds-disclosure` | `title` requerido, `group` opcional para acordeón nativo; contenido proyectado. Details/summary mantiene teclado y estado expandido sin ARIA duplicado; reduced motion. No poner acciones interactivas dentro del título. |
| CTA sticky | `ds-action-bar` | `placement` top/bottom; `layout` dock (predeterminado) / capsule (solo dirty explícito). Acciones de página van en `ds-page-header` `[dsPageActions]` (Admin `.actions`, gap 6px a la derecha), no en cápsula oscura: pastillas 28 px; `secondary`/`ghost`/`.tw:console-action-secondary` = blanco+borde; `primary` = marca; iconos 14 px. Opcional `.ds-page-header__action-group` = píldora clara de iconos (Admin `.icon-action-group`). |
| Guardado | `ds-save-bar` | Cápsula oscura centrada solo con dirty (`placement="top"` + `layout="capsule"`). No usar para CTAs de índice (Actualizar / Nueva…). |
| Feedback | `ds-empty-state`, `ds-banner`, `feedback-*` | Error recuperable, vacío con acción real, éxito y advertencia. No confundir fallo de carga con ausencia de datos. |
| Formularios | `console-field`, labels con utilities | Input nativo Admin Next: altura 32 px (44 px táctil), radio 12 px, sombra anillo; label 13/450; `aria-invalid` sustituye el ring por peligro. `ds-select` en consola comparte el mismo chrome. Asociar label/ayuda/error con IDs. |
| Datos/navegación | Utilities existentes | `console-list-panel`, `console-data-row`, `console-metric`, `console-filter-chip`, `console-filter-bar`, `console-index-table`, `console-list-skeleton`, navegación y sidebar. No crear versiones locales equivalentes. |
| Sidebar de consola | `console-navigation`, `console-nav-group`, `console-nav-divider`, `console-nav-label`, `console-rail-link` | Rail oscuro (`#1a1a1a`); item activo con highlight gris; búsqueda Ctrl K en el rail. Frame blanco redondeado sobre el canvas. Navegación de un solo nivel (Inicio + grupos Ventas, Catálogo y tienda, Conexiones, Resultados). Drawer móvil conserva targets táctiles. |
| Overlays | `dsModal`, `modal-frame`, confirmaciones existentes | Diálogos centrados con `dialog[dsModal]` + `tw:modal-frame` (backdrop oscurecido y difuminado). Gestión nativa de apertura/cierre y foco. Mantener bloqueo durante operaciones y retorno al origen. |

## Sticky CTA corporativo

Excepción: el editor visual de Tienda conserva su toolbar de cabecera sin `ds-action-bar` adicional. La configuración de Tienda concentra Guardar/Descartar/Publicar en una sola barra compartida.

Consola: cabecera sticky 52px (`ds-page-header`) full-bleed — índice con icono+título+acciones; detalle con back circular + migas `sección / vista`. Acciones a la derecha del toolbar (secundario/primario o `.ds-page-header__action-group` blanca) — Admin `.page-header` / `.actions` (gap 6px, pastillas 28 px). Cápsula oscura (`ds-save-bar` / action-bar capsule) solo dirty y siempre visible mientras haya cambios, via `ds-page-frame` overlay (mismo patrón que Productos `publish-frame`). Canales (WhatsApp/Instagram) monta conectar/verificar en `[dsPageActions]`; `ds-action-bar` dock queda para formularios de conexión que aún no migraron (p. ej. Cobros).

Tokens: `--ds-action-*`, `--ds-save-capsule-*`, `--ds-z-sticky`. Controles dock: `console-control-height` / 44 px táctil. Capsule: altura 36 px, controles 28 px. Bottom suma safe-area. Sin wrappers overflow que rompan sticky; sin Cancelar/Descartar sin handler.

```html
<ds-save-bar
  placement="top"
  layout="capsule"
  formId="product-form"
  [pending]="editorPending()"
  [busy]="saving()"
  label="Guardar"
  pendingText="Cambios no guardados"
>
  <ds-button type="button" variant="ghost" (click)="discardEditorChanges()">Descartar</ds-button>
</ds-save-bar>

<ds-save-bar [pending]="form.dirty" [busy]="saving()" label="Guardar envíos" />
```

## Composición de formularios

Preferencia de densidad: aprovechar el ancho disponible en vistas de datos y comparación, con resúmenes compactos y separadores antes que una tarjeta por cada dato. Información esencial visible; condiciones y ayuda opcionales en disclosures. La variante compact conserva los tamaños compartidos de controles y foco. Comfortable sigue disponible para formularios que necesitan más separación. La adopción compact de esta corrección se limita a Planes; las demás vistas requieren revisión individual.

```html
<ds-form-section title="Entrega" description="Cómo recibe el cliente su pedido." icon="truck">
  <ds-checkbox description="Tarifas referenciales por distrito">
    <input type="checkbox" formControlName="deliveryEnabled" />
    Envío a domicilio
  </ds-checkbox>
  <label>Dirección<input class="tw:console-field" formControlName="address" /></label>
</ds-form-section>
<ds-disclosure title="¿Cuándo se aplica el envío gratis?" group="delivery-faq">
  Se calcula sobre el total después de descuentos.
</ds-disclosure>
```

## Tailwind y gobernanza

Marketing consume los tokens `--ds-marketing-*` de ancho, tipografía, ritmo de secciones, líneas y superficies. Los CTA usan a[dsLink]; las acciones de la demo usan ds-button. Las variables de fondo/borde/texto secundarios y `--ds-button-padding-inline` permiten composición sobre la superficie oscura. Las preguntas reutilizan ds-disclosure con los tokens de contenido de marketing. La navegación móvil usa details/summary nativos, conserva la activación del enlace antes del cierre y devuelve el foco al summary con Escape.

Landing comercial (brief `docs/MARKETING-LANDING-BRIEF.md`): sitio de ventas con hero cinematográfico, manifiesto, stage de demo, historias de producto alternadas, setup, ecosistema, pricing/FAQ, cierre full-bleed y footer en columnas. Motion con `prefers-reduced-motion`. Demo, navegación móvil y metadatos con pruebas de regresión. Aceptación visual y auditoría a11y completa pendientes.

Tailwind 4 se integra mediante `apps/web/src/tailwind.css`, prefijo `tw:` y `@theme inline` conectado a los tokens. Mantener clases estáticas y semánticas; CSS compartido cuando proyección, estados nativos o interacción lo requieren. CSS de feature se limita a composición propia del dominio.

Antes de crear: buscar → reutilizar → componer → extender → definir contrato en esta matriz → implementar en packages → validar → consumir. No crear nuevas familias de controles ni duplicar el sistema en marketing/tienda. La tienda conserva sus tokens `--store-*`; cambios en packages requieren compilar web y store.

La matriz representa lo implementado y los gaps reales, no un catálogo ficticio: aún existen estilos heredados de features por migrar. No se declara conformidad WCAG completa sin auditoría visual, contraste y tecnología asistiva.

## Adopción y evidencia

Booleanos de consola: interruptor Admin Next de Shopify (`ds-checkbox` + nativos en `.tw:console-scope`); auth y tienda pública conservan casilla. Sin cambios en bindings ni handlers.

Sidebar de un solo nivel: nueve pruebas de navegación aprobadas y build web aprobado. Revisión en consola local: 14 iconos sobre el mismo eje horizontal (diferencia 0 px), cuatro separadores en el rail, sin desbordes ni listas anidadas. Inventario abre directamente; importación desde Productos y seis secciones internas de Vendedor IA operativas con módulo activo y nombre de página correctos. Drawer móvil a 390 px: targets de 44 px, sin desbordes y cierre al elegir Inventario. Movimiento reducido usa los tokens existentes; no se declara auditoría WCAG completa.

Revisión final de teclado: Enter expande/contrae y conserva el foco; Tab alcanza el buscador; Escape devuelve el foco al cerrar búsqueda. Menú de cuenta operable con flechas y Escape. En móvil, Tab/Shift+Tab circulan dentro del drawer y cerrar navegación o búsqueda devuelve foco a Abrir navegación. Sin cambios de comportamiento adicionales. Captura final indisponible en el navegador integrado; validación por imagen pendiente.

Planes: cabecera Admin con acciones, resumen de plan (`console-card` + badge de estado + consumo en rejilla con divisores), selector de período segmentado, cards de comparación estilo Admin (radio 20 px, precio jerárquico, CTA a ancho completo, features con hairlines) y paquetes de chats. Condiciones en `ds-disclosure`. El pago abre `app-plan-checkout` en `dialog[dsModal]` + `modal-frame`; no se cierra durante cobro o confirmación pendiente. Precios del plan actual resueltos desde el catálogo, porque currentPlan no incluye prepay.

Perfil compone identidad/formularios/sesiones con ds-form-section, console-field, ds-button, ds-save-bar, ds-disclosure y ds-empty-state, sin stylesheet local. Una sola barra al pie general para datos personales pendientes, asociada al formulario por ID; contraseña mantiene una acción secundaria dentro de su sección y su formulario independiente. Tienda usa una sola barra superior para Guardar/Descartar o Publicar/Despublicar según haya cambios. Veintiuna pruebas de Perfil, Tienda y componentes compartidos aprobadas; builds web y store aprobados. Navegador: barra única al editar/descartar, formularios asociados correctamente, sin desbordes a 390 px; botones normales y del CTA de 32 px en escritorio (cápsula de 40 px) y 44 px en móvil. Captura de Perfil revisada con una sola barra compacta. Store conserva la advertencia previa de presupuesto inicial (415,16 kB frente a 400 kB).

Ajustes consume ds-form-section, ds-select, console-field, ds-disclosure y ds-save-bar, sin stylesheet local. Resumen de configuración guardada y comparación de valores para cambios pendientes; descarte local, fieldset bloqueado al guardar y moneda guardada fuera de lista preservada. Cinco pruebas añadidas a la existente (seis en total); ejecución/build web pendientes por límite del revisor automático y revisión visual pendiente por bloqueo del navegador.

Métricas compone ds-form-section, console-metric, ds-select, ds-action-bar, ds-disclosure y ds-empty-state. Sin stylesheet de feature; selector 7/30 días en URL. Datos conservados durante actualización/fallo con período mostrado identificado; atención pendiente separada del rango. Seis pruebas añadidas, ejecución/build web pendientes por límite del revisor automático y revisión visual pendiente por bloqueo de navegador.

Integraciones reutiliza ds-form-section, ds-select, ds-disclosure, ds-empty-state, ds-action-bar y console-metric. Retira su stylesheet de filtros/tarjetas/status y compone con utilities centrales. Categoría en query params; funciones habilitadas separadas de conexiones externas. Seis tests añadidos, build web y ejecución pendientes por el límite del revisor automático; revisión visual pendiente por bloqueo de navegador.

Cobros compone estado, formulario y ayuda con ds-form-section, ds-select, console-field, ds-disclosure y ds-action-bar; no importa estilos de Tienda ni su stylesheet heredado. Estado de cuenta guardada separado del entorno seleccionado en el borrador. Siete pruebas añadidas y build web pendientes por bloqueo de revisión automática; sin aceptación visual mientras el navegador siga bloqueado. El stylesheet heredado de Cobros se conserva para Dominio, Medición y Equipo.

Barra compartida aplicada a Producto, Inventario, Descuentos, WhatsApp, Instagram, Cobros, Dominio, Medición, Ajustes y Tienda; Vendedor IA y Envíos usan `ds-save-bar`. Envíos compone checkbox, sección, disclosure y campos DS. Se conservan handlers, tipos de botón, permisos y operaciones de cada consumidor.

Tests de componentes verifican contrato con Angular forms, label, disabled, mixed, submit y busy; tests de Envíos verifican recuperación y guardado. Navegador bloqueado por política de URL en esta sesión: quedan pendientes capturas, medidas de sticky en scroll real, contraste visual y revisión móvil de esta migración. El resto de estilos heredados se migra por sección contra esta matriz.
