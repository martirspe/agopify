#!/usr/bin/env node
/**
 * Rebuild apps/api/prisma/migrations/0001_init/migration.sql from schema.prisma
 * plus prisma/sql/custom.sql. Only for empty / first-deploy history — never for
 * additive feature migrations (use `prisma migrate dev` after 0001_init).
 *
 * Usage (repo root, API container or local with Prisma):
 *   node scripts/prisma-build-init.mjs
 *   # or inside api container:
 *   docker compose -f docker-compose.dev.yml exec api node /app/scripts/prisma-build-init.mjs
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const apiPrisma = join(root, 'apps', 'api', 'prisma');
const out = join(apiPrisma, 'migrations', '0001_init', 'migration.sql');
const custom = join(apiPrisma, 'sql', 'custom.sql');

const diff = spawnSync(
  'npx',
  [
    'prisma',
    'migrate',
    'diff',
    '--from-empty',
    '--to-schema-datamodel',
    'prisma/schema.prisma',
    '--script',
  ],
  {
    cwd: join(root, 'apps', 'api'),
    encoding: 'utf8',
    shell: true,
  },
);

if (diff.status !== 0) {
  console.error(diff.stderr || diff.stdout || 'prisma migrate diff failed');
  process.exit(diff.status ?? 1);
}

const schemaSql = (diff.stdout || '').trimEnd();
const customSql = readFileSync(custom, 'utf8').trimEnd();
writeFileSync(out, `${schemaSql}\n\n${customSql}\n`, 'utf8');
console.log(`Wrote ${out}`);
