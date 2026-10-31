import { randomBytes } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';

const target = 'apps/api/.env';
const examplePath = '.env.example';
const generators = {
  JWT_ACCESS_SECRET: () => randomBytes(48).toString('base64url'),
  JWT_REFRESH_SECRET: () => randomBytes(48).toString('base64url'),
  META_VERIFY_TOKEN: () => randomBytes(48).toString('base64url'),
  PAYMENT_CREDENTIALS_KEY: () => randomBytes(32).toString('hex'),
  // Encrypts WhatsApp customer tokens for both Meta signup and customer-owned apps.
  CHANNEL_CREDENTIALS_KEY: () => randomBytes(32).toString('hex'),
};

function presentKeys(text) {
  return new Set(
    text
      .split(/\r?\n/)
      .map((line) => line.split('=')[0].trim())
      .filter((key) => /^[A-Z][A-Z0-9_]*$/.test(key)),
  );
}

if (!existsSync(target)) {
  const lines = readFileSync(examplePath, 'utf8')
    .split(/\r?\n/)
    .map((line) => {
      const key = line.split('=')[0];
      return generators[key] ? `${key}=${generators[key]()}` : line;
    });
  writeFileSync(target, lines.join('\n'), { mode: 0o600 });
  console.log(`Creado ${target} con secretos aleatorios para desarrollo.`);
}

const current = readFileSync(target, 'utf8');
const present = presentKeys(current);

// Secrets added after the file was created are appended, never overwritten.
const missingSecrets = Object.keys(generators).filter((key) => !present.has(key));
if (missingSecrets.length) {
  appendFileSync(
    target,
    `\n${missingSecrets.map((key) => `${key}=${generators[key]()}`).join('\n')}\n`,
  );
  console.log(`Añadido a ${target}: ${missingSecrets.join(', ')}.`);
}

// Append missing non-secret keys from .env.example (commented or set defaults).
const exampleLines = readFileSync(examplePath, 'utf8').split(/\r?\n/);
const presentAfter = presentKeys(readFileSync(target, 'utf8'));
const toAppend = [];
for (const line of exampleLines) {
  const active = line.match(/^\s*([A-Z][A-Z0-9_]*)=(.*)$/);
  const commented = line.match(/^\s*#\s*([A-Z][A-Z0-9_]*)=/);
  const key = active?.[1] ?? commented?.[1];
  if (!key || presentAfter.has(key) || generators[key]) continue;
  toAppend.push(active ? `${key}=${active[2]}` : line.trim());
  presentAfter.add(key);
}
if (toAppend.length) {
  appendFileSync(target, `\n# Completado desde .env.example\n${toAppend.join('\n')}\n`);
  console.log(`Completadas ${toAppend.length} claves nuevas en ${target} desde ${examplePath}.`);
}
