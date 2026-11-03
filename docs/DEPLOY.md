# Despliegue en producción

```text
Internet :80/:443
  → nginx del VPS (HTTPS automático)    ← scripts/bootstrap-host.sh
  → 127.0.0.1:8082 (nginx Docker)
  → web comercial (agopify.com) · consola + API (app.agopify.com) · tiendas ({slug}.agopify.com)
```

DNS en Cloudflare, solo DNS (nube gris): `A @` y `A *` → IP del VPS.

## 1. Código

```bash
sudo mkdir -p /opt/agopify && sudo chown "$USER":"$USER" /opt/agopify
cd /opt/agopify
git clone https://github.com/martirspe/agopify.git .
```

## 2. `.env`

Para habilitar el alta autónoma de WhatsApp por negocio, configura Embedded Signup y las variables indicadas en [WhatsApp onboarding](WHATSAPP-ONBOARDING.md). La verificación de la empresa no reemplaza la revisión de permisos ni la habilitación de proveedor tecnológico de la aplicación de Meta.

```bash
cp .env.production.example .env
nano .env
```

Mínimo:

```env
STORE_BASE_DOMAIN=agopify.com
CONSOLE_HOST=app.agopify.com
CERTBOT_EMAIL=tu@correo.com
CLOUDFLARE_API_TOKEN=...   # Cloudflare → Mi perfil → Tokens de API → "Editar DNS de zona" → agopify.com
```

Contraseñas y secretos se generan solos en el primer deploy (incluye `CHANNEL_CREDENTIALS_KEY` para cifrar WhatsApp). Meta, Mercado Pago, Turnstile, AWS y OpenAI son opcionales: el `.env.production.example` explica cada uno. Las fotos en S3/CloudFront y los correos con SES se crean con Terraform: [TERRAFORM.md](TERRAFORM.md).

## 3. Deploy

```bash
bash scripts/deploy.sh
```

Hace todo: secretos, validación (incluido el token de Cloudflare), backup, build, arranque, nginx del VPS, firewall 80/443 y un certificado HTTPS comodín (`agopify.com` + `*.agopify.com`) que se renueva solo.

## 4. Día a día

```bash
bash scripts/deploy.sh --pull                       # actualizar
npm run docker:logs:prod                            # logs
bash scripts/backup.sh                              # backup (base, .env y fotos) → backups/
bash scripts/restore-backup.sh backups/latest.tar.gz
```

Operadores de Agopify (superadmin y admin de la plataforma). Es la única forma de dar ese rol: el registro público no puede. Usa el modo interactivo para que la contraseña no quede en el historial:

```bash
docker compose exec api npm run create-admin                                   # interactivo
docker compose exec api npm run create-admin -- --role=ADMIN --email=ops@agopify.com
docker compose exec api npm run create-admin -- --revoke --email=ops@agopify.com
docker compose exec api npm run create-admin -- --help
```

Crea un SUPERADMIN después del primer deploy. No se puede quitar el rol al último SUPERADMIN, y cada cambio queda registrado en `PlatformAuditLog`. Alta de negocios, equipos y operadores, permisos y recuperación de acceso: [`USUARIOS.md`](./USUARIOS.md).

Webhooks a configurar fuera del VPS:

- Meta (WhatsApp): `https://app.agopify.com/api/v1/webhooks/meta/whatsapp` con `META_VERIFY_TOKEN`.
- Mercado Pago (cobro de planes): `https://app.agopify.com/api/v1/webhooks/billing/mercadopago`, evento Order (Mercado Pago). Detalle en [Mercado Pago](#mercado-pago).
- Meta (Instagram): en la app de Meta, producto Instagram → Webhooks, URL `https://app.agopify.com/api/v1/webhooks/meta/instagram` con `META_VERIFY_TOKEN`, campo `messages`. Firma con `INSTAGRAM_APP_SECRET` (si falta, usa `META_APP_SECRET`).

### Mercado Pago

Hay dos configuraciones separadas que nunca se mezclan: el cobro de los planes de Agopify (lo que cada negocio te paga a ti) y el cobro de cada tienda (lo que el comprador le paga al negocio).

| | Planes de Agopify | Tienda de cada negocio |
|---|---|---|
| Cuenta de Mercado Pago | La tuya | La del negocio |
| Credenciales | `.env` (`PLATFORM_MERCADOPAGO_*`) | Consola del negocio → Cobros (cifradas en la base) |
| Webhook | `https://app.agopify.com/api/v1/webhooks/billing/mercadopago` | `https://app.agopify.com/api/v1/webhooks/mercadopago/{tenantId}` |
| Eventos | Order (Mercado Pago) | Order (Mercado Pago) y Pagos |
| Dónde se paga | En la consola, en Planes (tarjeta o Yape) | En la tienda, en la página del pedido (tarjeta o Yape); los links que envía el agente por chat abren Mercado Pago |

**Planes de Agopify.** El negocio paga sin salir de la consola: el formulario de tarjeta (Card Payment Brick) y Yape de Mercado Pago se muestran en Planes, y la API cobra con la Orders API en tu cuenta. En tu aplicación de Mercado Pago:

1. Tus integraciones → Credenciales: copia el Access Token a `PLATFORM_MERCADOPAGO_ACCESS_TOKEN` y la Public Key a `PLATFORM_MERCADOPAGO_PUBLIC_KEY`. Las credenciales de prueba también empiezan por `APP_USR-`: usa las de prueba o las de producción, pero las dos del mismo ambiente que el webhook.
2. Webhooks → Configurar notificaciones: URL `https://app.agopify.com/api/v1/webhooks/billing/mercadopago`, evento **Order (Mercado Pago)**. Guarda y copia la clave secreta a `PLATFORM_MERCADOPAGO_WEBHOOK_SECRET`.
3. `bash scripts/deploy.sh`.

Sin las tres variables, comprar un plan pagado no está disponible en producción; el deploy falla si hay Access Token y clave secreta pero falta la Public Key. Para probar con credenciales de prueba, paga con las tarjetas de prueba de Mercado Pago (titular `APRO` aprobado, `OTHE` rechazado) o con Yape usando el celular `111111111`.

**Tiendas.** En el servidor solo hace falta `PAYMENT_CREDENTIALS_KEY`, que el primer deploy genera y que cifra las credenciales de cada negocio. No la cambies después: las cuentas ya conectadas dejarían de poder descifrarse. Cada negocio hace el resto desde su consola, en Cobros:

1. Crea una aplicación en su propia cuenta de Mercado Pago (debe ser de Perú).
2. Pega su Access Token y su Public Key.
3. En Webhooks de su aplicación pega la URL que muestra la consola (`…/webhooks/mercadopago/{tenantId}`), marca **Order (Mercado Pago)** y **Pagos**, guarda y pega la clave secreta en la consola.

Sin la clave secreta del webhook, la tienda no ofrece pago con tarjeta o Yape aunque el token sea válido.

En los dos casos el backend verifica la firma `x-signature`, ignora notificaciones repetidas y vuelve a consultar el estado real en Mercado Pago antes de marcar algo como pagado.

### Dominios propios de las tiendas (opcional)

Sin esto la integración «Dominio propio» aparece como «Próximamente» en producción.

1. Cloudflare → `agopify.com` → SSL/TLS → Custom Hostnames: activa Cloudflare for SaaS.
2. Crea `A customers` → IP del VPS **con nube naranja** y ponlo como Fallback Origin. Modo SSL de la zona: **Full** (el VPS responde con su certificado comodín).
3. En `.env`: `CLOUDFLARE_SAAS_ZONE_ID` (ID de zona), `CLOUDFLARE_SAAS_API_TOKEN` (token con `SSL and Certificates · Edit` sobre la zona) y `CUSTOM_DOMAIN_CNAME_TARGET=customers.agopify.com`.
4. `bash scripts/deploy.sh`: el nginx del VPS pasa a aceptar cualquier dominio y lo envía a la tienda, que solo responde a dominios verificados.
5. Turnstile: añade el dominio de cada tienda a los hostnames del widget (máximo 10 en el plan gratuito de Turnstile) o el checkout en ese dominio fallará la verificación.

### Cargar el catálogo de una tienda real

No uses los scripts `apps/api/scripts/seed-*.mjs` en producción: copian fotos al disco del contenedor y se saltan el límite del plan.

1. Crea el negocio desde el registro normal y deja el plan con cupo suficiente (por ejemplo, Crece para hasta 100 productos).
2. En la consola: Productos → Exportar paquete (ZIP con `catalog.json` + fotos) si necesitas respaldo antes de un reset; o Importar catálogo arrastrando la carpeta del paquete (`catalog.json` + `images/`; Selecta está en `apps/api/seed-data/selecta`).
3. Revisa la vista previa (creados, actualizados, sin publicar, avisos), marca «Aplicar los ajustes de tienda del paquete» si quieres plantilla y envíos, e importa. Las fotos se suben a S3 y nada se guarda si falla.

Para volver a importar cuando cambie el catálogo, usa la misma carpeta: solo se suben las fotos nuevas y se respetan el precio, el stock y la publicación cambiados en la consola, salvo que elijas actualizarlos.

### Base de datos (primer arranque o reset limpio)

El historial Prisma es **una sola** migración `0001_init` (tablas del schema + búsqueda full-text + triggers del outbox + categorías base). En un Postgres vacío, `migrate deploy` la aplica y listo. Cambios futuros: `prisma migrate dev` (migraciones aditivas nuevas); no reedites `0001_init`.

Si la base ya existe y quieres el mismo estado que un **primer deploy** (borra todos los tenants/pedidos/chats; fotos en S3/volumen y `.env` se conservan):

```bash
bash scripts/backup.sh
git pull
docker compose stop api web store
docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"'
bash scripts/deploy.sh
docker compose exec api npm run create-admin
```

## Si algo falla

| Síntoma | Qué hacer |
|---------|-----------|
| El build muere (`SIGKILL`) | Añade 2 GB de swap al VPS |
| Health check agota el tiempo | `docker compose logs --tail 100 migrate api` |
| Consola: «No pudimos cargar tu avance» / playground falla | Revisa `docker compose logs migrate api`. Suele ser schema a medias: haz el reset limpio de arriba tras backup, o corrige con una migración aditiva. |
| HTTPS muestra otro sitio o certificado | DNS mal apuntado o con nube naranja; corrígelo y `sudo bash scripts/bootstrap-host.sh` |
| `CLOUDFLARE_API_TOKEN cannot access the … zone` | El token no tiene permiso `Zona · DNS · Editar` sobre `agopify.com`; edítalo en Cloudflare |
