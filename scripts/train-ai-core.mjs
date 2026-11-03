/**
 * AI Core training gate (deterministic, offline).
 *
 * Default: build api → run gap-matrix curriculum.
 * --with-unit: also run understanding / sales-engine / tools Jest specs
 *   (use inside the api container or a machine with api jest deps).
 * --skip-build: reuse existing apps/api/dist
 *
 * Usage:
 *   npm run train:ai-core
 *   npm run train:ai-core -- --with-unit
 *   docker compose -f docker-compose.dev.yml exec -T api npm run train:ai-core -w @agopify/api -- --skip-build --with-unit
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';

function run(command, cmdArgs, opts = {}) {
  const useShell = opts.shell ?? (process.platform === 'win32' && command !== process.execPath);
  process.stdout.write(`\n» ${command} ${cmdArgs.join(' ')}\n`);
  const result = spawnSync(command, cmdArgs, {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
    ...opts,
    // npm.cmd needs a shell; process.execPath with spaces must not go through cmd.exe.
    shell: useShell,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (!args.has('--skip-build')) {
  run(npmCmd, ['run', 'build:api']);
}

if (args.has('--with-unit')) {
  run(
    npxCmd,
    [
      'jest',
      'conversation-understanding.spec.ts',
      'sales-engine.spec.ts',
      'sales-agent-tools.service.spec.ts',
      '--runInBand',
    ],
    { cwd: join(root, 'apps/api') },
  );
}

run(process.execPath, [join(root, 'scripts/evaluate-ai-core-training.cjs')]);

process.stdout.write(
  '\nAI Core training gate passed.\nReport: docs/agent/evals/ai-core-training-report.json\n',
);
