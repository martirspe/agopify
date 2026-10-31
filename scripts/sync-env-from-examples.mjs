#!/usr/bin/env node
/**
 * Merges missing keys from *.example into local env files without overwriting
 * existing values. Does not print secret values.
 *
 * Usage: node scripts/sync-env-from-examples.mjs
 */
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const generators = {
  JWT_ACCESS_SECRET: () => randomBytes(48).toString('base64url'),
  JWT_REFRESH_SECRET: () => randomBytes(48).toString('base64url'),
  META_VERIFY_TOKEN: () => randomBytes(48).toString('base64url'),
  PAYMENT_CREDENTIALS_KEY: () => randomBytes(32).toString('hex'),
  CHANNEL_CREDENTIALS_KEY: () => randomBytes(32).toString('hex'),
};

const PLACEHOLDER =
  /^(replace-with|changeme|your-|example\.|APP_USR-example)/i;

function parseLines(text) {
  return text.split(/\r?\n/);
}

function activeAssignments(lines) {
  /** @type {Map<string, string>} */
  const map = new Map();
  for (const line of lines) {
    const m = line.match(/^\s*([A-Z][A-Z0-9_]*)=(.*)$/);
    if (m) map.set(m[1], m[2]);
  }
  return map;
}

function merge({ targetPath, examplePath, preferFrom = [], forceDefaults = {} }) {
  if (!existsSync(examplePath)) {
    console.error(`Missing ${examplePath}`);
    return;
  }
  const exampleLines = parseLines(readFileSync(examplePath, 'utf8'));
  const exampleKeys = activeAssignments(exampleLines);

  /** @type {Map<string, string>} */
  const existing = new Map();
  let headerComments = [];
  if (existsSync(targetPath)) {
    const current = parseLines(readFileSync(targetPath, 'utf8'));
    for (const line of current) {
      const m = line.match(/^\s*([A-Z][A-Z0-9_]*)=(.*)$/);
      if (m) existing.set(m[1], m[2]);
    }
  }

  for (const path of preferFrom) {
    if (!existsSync(path)) continue;
    const donor = activeAssignments(parseLines(readFileSync(path, 'utf8')));
    for (const [key, value] of donor) {
      if (!value || PLACEHOLDER.test(value)) continue;
      const cur = existing.get(key);
      if (!cur || PLACEHOLDER.test(cur) || cur === '') existing.set(key, value);
    }
  }

  for (const [key, value] of Object.entries(forceDefaults)) {
    if (!existing.has(key) || existing.get(key) === '' || PLACEHOLDER.test(existing.get(key) ?? '')) {
      existing.set(key, value);
    }
  }

  for (const [key, gen] of Object.entries(generators)) {
    const cur = existing.get(key);
    if (!cur || PLACEHOLDER.test(cur)) existing.set(key, gen());
  }

  const out = [];
  const written = new Set();
  for (const line of exampleLines) {
    const m = line.match(/^\s*([A-Z][A-Z0-9_]*)=(.*)$/);
    if (!m) {
      out.push(line);
      continue;
    }
    const key = m[1];
    written.add(key);
    const value = existing.has(key) ? existing.get(key) : m[2];
    out.push(`${key}=${value ?? ''}`);
  }

  // Preserve keys that exist locally but are not in the example (legacy leftovers).
  const extras = [...existing.keys()].filter((k) => !written.has(k));
  if (extras.length) {
    out.push('');
    out.push('# Claves locales no listadas en el example (revisar / migrar):');
    for (const key of extras.sort()) {
      // Drop known obsolete aliases.
      if (['AWS_S3_BUCKET', 'CLOUDFRONT_URL', 'PAYMENTS_ENABLED', 'MERCADOPAGO_ACCESS_TOKEN', 'MERCADOPAGO_WEBHOOK_SECRET'].includes(key)) {
        continue;
      }
      out.push(`${key}=${existing.get(key)}`);
    }
  }

  writeFileSync(targetPath, `${out.join('\n').replace(/\n+$/, '')}\n`, { mode: 0o600 });
  const added = [...exampleKeys.keys()].filter((k) => !written.has(k) || true);
  console.log(`Updated ${targetPath} (${exampleKeys.size} example keys; dropped obsolete aliases if present).`);
}

merge({
  targetPath: 'apps/api/.env',
  examplePath: '.env.example',
  preferFrom: ['.env', 'apps/api/.env'],
  forceDefaults: {
    SALES_ENGINE_MODE: 'ai-core',
    OPENAI_MODEL: 'gpt-4.1-mini',
    MEDIA_STORAGE: 'local',
    UPLOADS_DIR: 'uploads',
    EMAIL_MODE: 'preview',
    STOREFRONT_URL_TEMPLATE: 'http://{slug}.localhost:4300',
    REDIS_URL: '',
  },
});

merge({
  targetPath: '.env',
  examplePath: '.env.example',
  preferFrom: ['.env', 'apps/api/.env'],
  forceDefaults: {
    SALES_ENGINE_MODE: 'ai-core',
    OPENAI_MODEL: 'gpt-4.1-mini',
    MEDIA_STORAGE: 'local',
    UPLOADS_DIR: 'uploads',
    EMAIL_MODE: 'preview',
  },
});

merge({
  targetPath: '.env.production',
  examplePath: '.env.production.example',
  preferFrom: ['.env.production'],
  forceDefaults: {
    SALES_ENGINE_MODE: 'ai-core',
    OPENAI_MODEL: 'gpt-4.1-mini',
    REDIS_URL: 'redis://redis:6379/0',
    META_GRAPH_VERSION: 'v26.0',
  },
});
