#!/usr/bin/env node
/**
 * Rewrites a target .env using the structure of an example file, keeping
 * existing values for keys that appear (active or commented) in the example.
 * Each key is written at most once. Does not print values.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const [,, examplePath, targetPath] = process.argv;
if (!examplePath || !targetPath || !existsSync(examplePath) || !existsSync(targetPath)) {
  console.error('Usage: node scripts/trim-env-to-example.mjs <.env.example> <target.env>');
  process.exit(1);
}

const example = readFileSync(examplePath, 'utf8').split(/\r?\n/);
const existing = new Map();
for (const line of readFileSync(targetPath, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z][A-Z0-9_]*)=(.*)$/);
  if (m) existing.set(m[1], m[2]);
}

const known = new Set();
for (const line of example) {
  const m = line.match(/^\s*#?\s*([A-Z][A-Z0-9_]*)=/);
  if (m) known.add(m[1]);
}

const written = new Set();
const out = [];
for (const line of example) {
  const active = line.match(/^\s*([A-Z][A-Z0-9_]*)=(.*)$/);
  const commented = line.match(/^\s*#\s*([A-Z][A-Z0-9_]*)=(.*)$/);
  if (active) {
    const key = active[1];
    if (written.has(key)) continue;
    written.add(key);
    out.push(`${key}=${existing.has(key) ? existing.get(key) : active[2]}`);
    continue;
  }
  if (commented) {
    const key = commented[1];
    if (written.has(key)) continue;
    if (existing.has(key) && existing.get(key) !== '') {
      written.add(key);
      out.push(`${key}=${existing.get(key)}`);
    } else {
      out.push(line);
    }
    continue;
  }
  out.push(line);
}

const dropped = [...existing.keys()].filter((k) => !known.has(k));
writeFileSync(targetPath, `${out.join('\n').replace(/\n+$/, '')}\n`, { mode: 0o600 });
console.log(`Trimmed ${targetPath}; dropped ${dropped.length}: ${dropped.join(', ') || '(none)'}`);
