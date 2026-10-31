# VendedorIA

Premium AI Sales Agents SaaS — WhatsApp/Instagram sales agents from greeting to payment.

Authority document: [`PROJECT CONSTITUTION.md`](./PROJECT%20CONSTITUTION.md) · Agent instructions: [`AGENTS.md`](./AGENTS.md)

## Stack

- **Web:** Angular 22 (standalone, signals, zoneless, SSR) + Design System tokens
- **API:** NestJS 11 + Fastify + Prisma + PostgreSQL + JWT/refresh
- **Payments (next):** Mercado Pago via payment provider port

## Structure

```
apps/api     NestJS API (`/api/v1`, Swagger at `/docs`)
apps/web     Angular console + marketing
apps/store   Tienda pública por tenant (SSR, `{slug}.dominio`)
packages/*   Design system, tokens y contratos compartidos
```

## Desarrollo (Docker)

Todo el día a día corre en Docker. No hace falta instalar Node ni Postgres en el host.

### Requisitos

- Docker Desktop (Compose v2) en marcha
- En la raíz del repo: `package.json` y `docker-compose.dev.yml` (para `npm run …`)

### Primer arranque / día a día

```bash
npm run dev
```

Eso:

1. Crea o completa `apps/api/.env` desde `.env.example` (secretos locales aleatorios si faltan).
2. Levanta **solo** lo necesario: Postgres + API + consola (`web`).  
   `deps` es un one-shot (`npm ci` + Prisma generate) y sale; no queda un contenedor de más corriendo.
3. Aplica migraciones (`0001_init` en base vacía) y arranca Nest / Angular con recarga en caliente.

Cuando `docker compose ps` muestre `api` y `web` healthy:

| Qué | URL |
|-----|-----|
| Consola | http://localhost:4201 |
| API / health | http://localhost:3100/api/v1/health |
| Swagger | http://localhost:3100/docs |
| Postgres (host) | `localhost:5432` — usuario/clave/db: `postgres` / `postgres` / `vendedoria` |

Usa siempre **`localhost`** (no `127.0.0.1` en el navegador): los puertos escuchan en loopback y los enlaces de Docker Desktop redirigen a `localhost`.

### Servicios opcionales

No son obligatorios para vender por WhatsApp ni para la consola:

| Comando | Qué añade | Cuándo |
|---------|-----------|--------|
| `npm run dev:store` | Tienda en http://`{slug}`.localhost:4300 | Probar storefront / checkout web |
| `npm run dev:redis` | Redis | Recuperación / caché conversion; luego `REDIS_URL=redis://redis:6379/0` en `apps/api/.env` y reinicia el API |
| `npm run dev:all` | Tienda + Redis | Stack completo local |
| Profile `recommendations-vector` | Qdrant | Búsqueda semántica (sin él basta el full-text de Postgres) |

```bash
docker compose -f docker-compose.dev.yml --profile recommendations-vector up -d qdrant
# y en apps/api/.env: QDRANT_URL=http://qdrant:6333
```

### Comandos útiles

```bash
npm run docker:ps      # estado
npm run docker:logs    # api + web (añade store si lo levantaste: npm run docker:logs -- store)
npm run docker:down    # apaga el stack (incluye perfiles)
npm run test:docker    # unit + e2e en DB aislada vendedoria_test (stack core debe estar up)
```

### Configuración local

- Variables: `apps/api/.env` (plantilla: [`.env.example`](./.env.example)). Docker sobrescribe `PORT`, `DATABASE_URL`, `CORS_ORIGIN` y URLs públicas dentro del contenedor.
- `OPENAI_API_KEY` opcional: sin clave el vendedor usa respuestas deterministas; con clave, playground y canales usan el modelo.
- Meta / Turnstile / Mercado Pago: solo si pruebas esas integraciones (ver comentarios en `.env.example`).

### Flujo habitual de código

- Guardar un archivo recarga API (Nest `--watch`) y consola (`ng serve` con sondeo; necesario en Docker Desktop/Windows).
- Tras cambiar `package.json` / lock: `npm run dev` otra vez para que `deps` rehaga `npm ci`.
- Migración nueva:  
  `docker compose -f docker-compose.dev.yml exec api npx prisma migrate dev --name <snake_case>`
- Una sola vez si vienes del stack Docker antiguo: `npm run docker:clean-legacy` (conserva el volumen de Postgres).
- Puertos distintos de selecta (3000/4200/5433): ambos stacks pueden correr a la vez.

### Usuarios en desarrollo

**No hace falta `create-admin` para usar la consola del negocio.** El registro público en http://localhost:4201 crea el negocio y su `OWNER`. Con eso pruebas vendedor, catálogo, playground, canales, etc.

`create-admin` solo crea **operadores de plataforma** (`SUPERADMIN` / `ADMIN` de VendedorIA), sesión distinta (`/platform/…`), para el backoffice global — no es el admin del tenant. En local solo si trabajas esa consola:

```bash
docker compose -f docker-compose.dev.yml exec api npm run create-admin
```

Detalle: [`docs/USUARIOS.md`](./docs/USUARIOS.md).

### Smoke rápido tras levantar

1. Consola → **Crear cuenta** (negocio) o login.
2. Completa el vendedor (Empezar / perfil).
3. **Playground** del vendedor: un saludo y una pregunta de catálogo.
4. (Opcional) Canales → simular mensaje entrante → Inbox → pedido / link de pago.

## Producción (Docker)

Guía completa: [`docs/DEPLOY.md`](./docs/DEPLOY.md).

```bash
cp .env.production.example .env   # dominio, CERTBOT_EMAIL y CLOUDFLARE_API_TOKEN
bash scripts/deploy.sh            # actualizar: bash scripts/deploy.sh --pull
```

Fotos S3/CloudFront y SES (opcional): Terraform en `infra/terraform/`, guía en [`docs/TERRAFORM.md`](./docs/TERRAFORM.md).

## Build

```bash
npm run build
```
