#!/usr/bin/env bash
# One-shot: after squashing Prisma history into 0001_init, align an existing database
# without DROP SCHEMA. Applies missing AI Core / knowledge columns if needed, verifies
# the live schema matches schema.prisma, then rewrites _prisma_migrations to a single
# applied 0001_init (checksum from the migration file — SQL CREATE is NOT re-run).
#
# Usage (production, from repo root with .env):
#   bash scripts/backup.sh --no-media
#   git pull
#   docker compose build migrate          # image must include the new 0001_init
#   bash scripts/prisma-baseline-squash.sh
#   bash scripts/deploy.sh
#
# Dev stack:
#   bash scripts/prisma-baseline-squash.sh --dev
#
# Requires: Docker Compose v2, running postgres. Production uses a one-off `migrate`
# container (Prisma CLI); --dev uses the hot-reload `api` service.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

COMPOSE=(docker compose)
PG_SERVICE=postgres
DEV=false

log() { printf '\033[1;34m[baseline]\033[0m %s\n' "$*"; }
err() { printf '\033[1;31m[baseline]\033[0m %s\n' "$*" >&2; }

for arg in "$@"; do
  case "$arg" in
    --dev)
      DEV=true
      COMPOSE=(docker compose -f docker-compose.dev.yml)
      ;;
    -h|--help)
      echo "Usage: bash scripts/prisma-baseline-squash.sh [--dev]"
      exit 0
      ;;
    *)
      err "Unknown option: $arg"
      exit 1
      ;;
  esac
done

ENSURE_SQL="${ROOT}/apps/api/prisma/baseline-ensure.sql"
INIT_SQL="${ROOT}/apps/api/prisma/migrations/0001_init/migration.sql"

[[ -f "$ENSURE_SQL" ]] || { err "Missing $ENSURE_SQL"; exit 1; }
[[ -f "$INIT_SQL" ]] || { err "Missing $INIT_SQL"; exit 1; }

if ! "${COMPOSE[@]}" ps --status running --services 2>/dev/null | grep -qx "$PG_SERVICE"; then
  err "Postgres is not running (${PG_SERVICE}). Start the stack first."
  exit 1
fi

# Prisma CLI: hot-reload api in dev; production migrate image (has migrations + prisma).
prisma() {
  if [[ "$DEV" == true ]]; then
    if ! "${COMPOSE[@]}" ps --status running --services 2>/dev/null | grep -qx api; then
      err "API is not running. Start the dev stack first."
      exit 1
    fi
    "${COMPOSE[@]}" exec -T api npx prisma "$@"
  else
    "${COMPOSE[@]}" run --rm --no-deps migrate npx prisma "$@"
  fi
}

if [[ "$DEV" == true ]]; then
  PG_USER=postgres
  PG_DB=vendedoria
else
  POSTGRES_USER="$(grep -E '^POSTGRES_USER=' .env 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\r' || true)"
  POSTGRES_DB="$(grep -E '^POSTGRES_DB=' .env 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\r' || true)"
  PG_USER="${POSTGRES_USER:-vendedoria}"
  PG_DB="${POSTGRES_DB:-vendedoria}"
fi

psql_exec() {
  "${COMPOSE[@]}" exec -T "$PG_SERVICE" psql -U "$PG_USER" -d "$PG_DB" -v ON_ERROR_STOP=1 "$@"
}

log "Applying idempotent ensure SQL (missing columns / enums)…"
psql_exec -f - < "$ENSURE_SQL"

log "Checking live schema vs prisma/schema.prisma…"
DIFF="$(prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script 2>/dev/null || true)"
if echo "$DIFF" | grep -Eqi '^(CREATE|ALTER|DROP|UPDATE|DELETE|INSERT|TRUNCATE)\b'; then
  err "Schema drift remains after ensure. Refusing to baseline. Diff:"
  echo "$DIFF" >&2
  exit 1
fi
log "Schema matches (no structural diff)."

COUNT="$(psql_exec -Atc 'SELECT count(*) FROM "_prisma_migrations";' | tr -d '[:space:]')"
log "Found ${COUNT} row(s) in _prisma_migrations; replacing with a single applied 0001_init…"
psql_exec -c 'DELETE FROM "_prisma_migrations";'

# Prisma writes the correct checksum from the migration file without running CREATE SQL.
prisma migrate resolve --applied 0001_init

log "Verifying migrate status…"
STATUS="$(prisma migrate status 2>&1)"
echo "$STATUS"
if ! echo "$STATUS" | grep -qi 'Database schema is up to date'; then
  err "Baseline finished but migrate status is not clean. Inspect the output above."
  exit 1
fi
ROWS="$(psql_exec -Atc 'SELECT count(*) FROM "_prisma_migrations";' | tr -d '[:space:]')"
if [[ "$ROWS" != "1" ]]; then
  err "Expected exactly 1 migration row, found ${ROWS}."
  exit 1
fi

log "Done. Safe to run deploy / migrate deploy. Do not re-run unless you squash again."
