# Brief canónico — Landing comercial Agopify

Prompt y criterios de aceptación para llevar `apps/web` → `features/marketing` a una experiencia web comercial de élite (nivel de craft de Shopify.com), sin clonar Shopify ni competidores de categoría.

Usar con el skill `agopify-ui` y el workflow `agopify-implement`. Autoridad de producto: `PROJECT CONSTITUTION.md` (secciones de tesis, identidad visual, SEO, performance). Tokens y contratos: `docs/DESIGN-SYSTEM.md`.

---

## Rol

Director de producto + lead de diseño de producto + ingeniero frontend senior. Elevar la landing desde página funcional a **interfaz comercial completa**: narrativa, jerarquía, estados, a11y, SEO, performance y copy en español de producción. No improvisar. No rediseño decorativo.

## Producto

**Agopify**: SaaS multi-tenant — agentes IA de ventas en WhatsApp e Instagram (“del hola al pago”) + tienda web por tenant (hoy: en desarrollo / acceso anticipado, sin compromiso comercial oficial).

- El vendedor IA atiende, usa catálogo real (precio/stock) y guía hasta el pago.
- El operador supervisa en consola (inbox, pedidos, pausa IA, playground).
- Flujo B: cobros vía Mercado Pago a la cuenta del merchant.
- Flujo A (plan SaaS) y Flujo B (pedido) siempre separados en dominio, UI y copy.

**Prohibido:** capacidades inventadas, métricas falsas, “IA mágica”, tienda web como feature oficial de plan, naming/copy/UI de competidores.

## Objetivo de conversión

1. Primario → `/auth/register` (7 días Crece, sin tarjeta, sin cobro automático).
2. Secundario → demo / “ver cómo vende”.
3. Terciario → `/auth/login`.

## Identidad (no reinventar)

| Señal | Valor |
| --- | --- |
| Primary | `#C8F542` |
| Ink / marketing bg | `#0B0D12` |
| Surface elevated | `#141822` |
| Accent | `#5B8CFF` |
| Display | Satoshi |
| UI | Manrope |
| Iconos | `ds-icon` (Lucide + logos oficiales) |

Consumir `--ds-*` / `--ds-marketing-*`. Search → reuse → compose → extend. Evitar look IA genérico (púrpura, cream+serif+terracota, glow spam, card grid vacío, emojis decorativos).

## Stack

Angular 22 standalone, `OnPush`, signals, prerender SSR en marketing. Verificar `npm run build:web` y specs de marketing. `CHANGELOG.md` → `[Unreleased]` si el cambio es product-relevant.

## Principios de composición

1. Una composición por viewport (no dashboard).
2. Marca primero: Agopify es señal hero-level.
3. Hero budget: marca + un H1 + una frase + un grupo CTA + una demo dominante.
4. Sin cards por defecto; card solo si hay interacción.
5. Una job por sección.
6. Ancla visual real (demo de venta), no solo gradientes.
7. Motion con propósito (2–3) + `prefers-reduced-motion`.
8. Mobile-first; CTAs críticos siempre alcanzables.

## Arco de secciones (implementado)

1. Chrome sticky (scroll state)
2. Hero cinematográfico (marca dominante + promesa + composición chat↔tienda)
3. Manifiesto tipográfico (`#producto`)
4. Stage de demo interactivo con chips de mensaje (`#demo`)
5. Pilares de plataforma (`#plataforma`: agentes IA · tienda pronto)
6. Historias de producto (chat · control · confianza)
7. Store story (pronto, honesto) + ecosistema conectado
8. Cómo funciona (3 pasos) · canales · beneficios · casos (`#casos`)
9. Integraciones verificadas → Pricing → FAQ → cierre full-bleed → footer columnas

Planes y FAQ: `marketing-content.ts` (Inicia 29 · Crece 79 featured · Escala 199 · Lidera 549).

## Criterios de aceptación

- [ ] First viewport = una composición de marca + producto
- [ ] Agopify dominante; H1 no apaga la marca
- [ ] Demo creíble en desktop y mobile
- [ ] Sin claims inventados; tienda “pronto”
- [ ] Pricing/FAQ alineados al content canónico
- [ ] Solo tokens DS; Satoshi/Manrope; `ds-icon`
- [ ] CTAs a rutas reales de auth
- [ ] `build:web` + specs marketing OK
- [ ] Parece SaaS listo para vender, preferible al referente de categoría

## Frase guía

No redescores una landing. Construye la cara comercial de un producto que ya cierra ventas — con el craft de Shopify y la identidad propia de Agopify.
