import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { BadRequestException } from '@nestjs/common';

const BLOCKED_HOSTS = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata.google.com',
]);

function isPrivateIp(ip: string): boolean {
  if (ip === '::1' || ip.startsWith('fe80:') || ip.startsWith('fc') || ip.startsWith('fd')) {
    return true;
  }
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return false;
  const [a, b] = parts;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

/** Validates a merchant-supplied store base URL against SSRF classes before outbound calls. */
export async function assertSafeStoreBaseUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new BadRequestException('La URL de la tienda no es válida.');
  }
  if (url.protocol !== 'https:') {
    throw new BadRequestException('La URL de la tienda debe usar HTTPS.');
  }
  if (url.username || url.password) {
    throw new BadRequestException('La URL de la tienda no puede incluir credenciales.');
  }
  if (url.port && url.port !== '443') {
    throw new BadRequestException('La URL de la tienda solo puede usar el puerto 443.');
  }
  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(host) || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new BadRequestException('La URL de la tienda no está permitida.');
  }
  if (isIP(host)) {
    if (isPrivateIp(host)) {
      throw new BadRequestException('La URL de la tienda no puede apuntar a una red privada.');
    }
    return url;
  }
  let addresses: Array<{ address: string }>;
  try {
    addresses = await lookup(host, { all: true, verbatim: true });
  } catch {
    throw new BadRequestException('No pudimos resolver el dominio de la tienda.');
  }
  if (!addresses.length || addresses.some((entry) => isPrivateIp(entry.address))) {
    throw new BadRequestException('La URL de la tienda no puede apuntar a una red privada.');
  }
  return url;
}

export function storeOrigin(url: URL): string {
  return `${url.protocol}//${url.host}`;
}
