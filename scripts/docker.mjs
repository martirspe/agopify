import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const mode = process.argv[2] || 'dev';
const flags = process.argv.slice(3);
const local = join(process.env.LOCALAPPDATA || '', 'Programs', 'DockerDesktop', 'resources', 'bin', 'docker.exe');
const docker = process.platform === 'win32' && existsSync(local) ? local : 'docker';
const composeFile = ['compose', '-f', 'docker-compose.dev.yml'];
// Stack anterior: la base `db` del proyecto `vendedoria`.
const legacy = { project: 'vendedoria', service: 'db' };
const keepVolumes = new Set(['vendedoria_vendedoria_pg', 'vendedoria_pgdata']);

/** Default stack: postgres + deps (one-shot) + api + web. */
const CORE = ['postgres', 'deps', 'api', 'web'];

function parseProfiles(argv) {
  const profiles = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--profiles' || arg === '--profile') {
      const value = argv[++i] || '';
      profiles.push(...value.split(',').map((p) => p.trim()).filter(Boolean));
    } else if (arg.startsWith('--profile=')) {
      profiles.push(...arg.slice('--profile='.length).split(',').map((p) => p.trim()).filter(Boolean));
    } else if (arg.startsWith('--profiles=')) {
      profiles.push(...arg.slice('--profiles='.length).split(',').map((p) => p.trim()).filter(Boolean));
    }
  }
  return [...new Set(profiles)];
}

function run(args, { exit = true } = {}) {
  const result = spawnSync(docker, args, { stdio: 'inherit' });
  if (result.error) throw new Error('No se pudo ejecutar Docker Desktop. Revisa su instalación.');
  if (result.status !== 0 && exit) process.exit(result.status || 1);
  return result.status === 0;
}

function list(args) {
  const result = spawnSync(docker, args, { encoding: 'utf8' });
  return result.status === 0 ? result.stdout.split(/\r?\n/).filter(Boolean) : [];
}

function removeLegacyContainers() {
  const ids = list([
    'ps', '-aq',
    '--filter', `label=com.docker.compose.project=${legacy.project}`,
    '--filter', `label=com.docker.compose.service=${legacy.service}`,
  ]);
  if (ids.length) {
    console.log('Eliminando contenedores del stack anterior (vendedoria-db)…');
    run(['rm', '-f', ...ids]);
  }
}

function profileArgs(profiles) {
  return profiles.flatMap((p) => ['--profile', p]);
}

if (mode === 'dev') {
  const setup = spawnSync(process.execPath, ['scripts/setup-local.mjs'], { stdio: 'inherit' });
  if (setup.status) process.exit(setup.status);
  removeLegacyContainers();
  const profiles = parseProfiles(flags);
  const services = [...CORE];
  if (profiles.includes('store')) services.push('store');
  if (profiles.includes('redis')) services.push('redis');
  if (profiles.includes('recommendations-vector')) services.push('qdrant');
  run([
    ...composeFile,
    ...profileArgs(profiles),
    'up',
    '-d',
    '--build',
    '--remove-orphans',
    '--wait',
    ...services,
  ]);
  const lines = [
    'VendedorIA en Docker (mínimo: postgres + api + consola):',
    '  Consola  http://localhost:4201',
    '  API      http://localhost:3100/api/v1  (Swagger: http://localhost:3100/docs)',
  ];
  if (profiles.includes('store')) {
    lines.push('  Tiendas  http://{slug}.localhost:4300');
  } else {
    lines.push('  Tienda   (opcional) npm run dev:store');
  }
  if (profiles.includes('redis')) {
    lines.push('  Redis    activo — pon REDIS_URL=redis://redis:6379/0 en apps/api/.env');
  }
  lines.push('  Logs     npm run docker:logs');
  console.log(lines.join('\n'));
} else if (mode === 'down') run([...composeFile, '--profile', 'store', '--profile', 'redis', '--profile', 'recommendations-vector', 'down']);
else if (mode === 'logs') {
  const services = flags.length ? flags : ['api', 'web'];
  run([...composeFile, 'logs', '-f', '--tail', '200', ...services]);
} else if (mode === 'ps') run([...composeFile, 'ps', '-a']);
else if (mode === 'test') {
  // Base aislada vendedoria_test; requiere stack core arriba.
  run([...composeFile, 'exec', '-T', 'postgres', 'sh', '-c',
    "psql -U postgres -d vendedoria -tAc \"SELECT 1 FROM pg_database WHERE datname='vendedoria_test'\" | grep -q 1 || createdb -U postgres vendedoria_test"]);
  const env = {
    DATABASE_URL: 'postgresql://postgres:postgres@postgres:5432/vendedoria_test?schema=public',
    NODE_ENV: 'test',
    RUN_ISOLATED_COMMERCE_TESTS: '1',
    MERCADOPAGO_ACCESS_TOKEN: '',
    OPENAI_API_KEY: '',
    REDIS_URL: '',
  };
  const envFlags = Object.entries(env).flatMap(([key, value]) => ['-e', `${key}=${value}`]);
  run([...composeFile, 'exec', '-T', ...envFlags, 'api', 'sh', '-c',
    'npx prisma migrate deploy && npx jest && npx jest --config ./test/jest-e2e.json']);
} else if (mode === 'clean-legacy') {
  removeLegacyContainers();
  const volumes = list(['volume', 'ls', '-q', '--filter', `label=com.docker.compose.project=${legacy.project}`])
    .filter((volume) => !keepVolumes.has(volume));
  if (volumes.length) {
    console.log(`Eliminando volúmenes sin uso: ${volumes.join(', ')}`);
    run(['volume', 'rm', ...volumes], { exit: false });
  }
  run(['image', 'prune', '-f'], { exit: false });
  console.log('Listo. Solo queda el stack de desarrollo (vendedoria-dev).');
} else {
  throw new Error('Modo no reconocido. Usa dev, down, logs, ps, test o clean-legacy.');
}
