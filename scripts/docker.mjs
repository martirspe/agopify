import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const mode = process.argv[2] || 'dev';
const flags = process.argv.slice(3);
const local = join(process.env.LOCALAPPDATA || '', 'Programs', 'DockerDesktop', 'resources', 'bin', 'docker.exe');
const docker = process.platform === 'win32' && existsSync(local) ? local : 'docker';
const composeFile = ['compose', '-f', 'docker-compose.dev.yml'];
const keepVolumes = new Set(['agopify_pg', 'agopify_pgdata']);

/** Default stack: postgres + deps (one-shot) + api + web + store. */
const CORE = ['postgres', 'deps', 'api', 'web', 'store'];

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

function profileArgs(profiles) {
  return profiles.flatMap((p) => ['--profile', p]);
}

if (mode === 'dev') {
  const setup = spawnSync(process.execPath, ['scripts/setup-local.mjs'], { stdio: 'inherit' });
  if (setup.status) process.exit(setup.status);
  const profiles = parseProfiles(flags).filter((p) => p !== 'store');
  const services = [...CORE];
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
    'Agopify en Docker (postgres + api + consola + tienda):',
    '  Consola  http://localhost:4201',
    '  API      http://localhost:3100/api/v1  (Swagger: http://localhost:3100/docs)',
    '  Tiendas  http://{slug}.localhost:4300',
  ];
  if (profiles.includes('redis')) {
    lines.push('  Redis    activo — pon REDIS_URL=redis://redis:6379/0 en apps/api/.env');
  } else {
    lines.push('  Redis    (opcional) npm run dev:redis');
  }
  lines.push('  Logs     npm run docker:logs');
  console.log(lines.join('\n'));
} else if (mode === 'down') run([...composeFile, '--profile', 'redis', '--profile', 'recommendations-vector', 'down']);
else if (mode === 'logs') {
  const services = flags.length ? flags : ['api', 'web', 'store'];
  run([...composeFile, 'logs', '-f', '--tail', '200', ...services]);
} else if (mode === 'ps') run([...composeFile, 'ps', '-a']);
else if (mode === 'test') {
  // Base aislada agopify_test; requiere stack core arriba.
  run([...composeFile, 'exec', '-T', 'postgres', 'sh', '-c',
    "psql -U postgres -d agopify -tAc \"SELECT 1 FROM pg_database WHERE datname='agopify_test'\" | grep -q 1 || createdb -U postgres agopify_test"]);
  const env = {
    DATABASE_URL: 'postgresql://postgres:postgres@postgres:5432/agopify_test?schema=public',
    NODE_ENV: 'test',
    RUN_ISOLATED_COMMERCE_TESTS: '1',
    MERCADOPAGO_ACCESS_TOKEN: '',
    OPENAI_API_KEY: '',
    REDIS_URL: '',
  };
  const envFlags = Object.entries(env).flatMap(([key, value]) => ['-e', `${key}=${value}`]);
  run([...composeFile, 'exec', '-T', ...envFlags, 'api', 'sh', '-c',
    'npx prisma migrate deploy && node ../../scripts/load-catalog-taxonomy.mjs && npx jest && npx jest --config ./test/jest-e2e.json']);
} else if (mode === 'clean-legacy') {
  const volumes = list(['volume', 'ls', '-q', '--filter', 'label=com.docker.compose.project=agopify-dev'])
    .filter((volume) => !keepVolumes.has(volume));
  if (volumes.length) {
    console.log(`Eliminando volúmenes sin uso: ${volumes.join(', ')}`);
    run(['volume', 'rm', ...volumes], { exit: false });
  }
  run(['image', 'prune', '-f'], { exit: false });
  console.log('Listo. Solo queda el stack de desarrollo (agopify-dev).');
} else {
  throw new Error('Modo no reconocido. Usa dev, down, logs, ps, test o clean-legacy.');
}
