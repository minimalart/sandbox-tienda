import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const integration = process.argv.includes('--integration');
if (integration && !process.env.CHECKOUT_TEST_DATABASE_URL) {
  console.error(
    'CHECKOUT_TEST_DATABASE_URL is required. Use a disposable PostgreSQL test database; integration tests must not be silently skipped.'
  );
  process.exit(1);
}
const directory = 'src/modules/demo-store/checkout';
const files = readdirSync(path.join(root, directory))
  .filter(
    (name) => name.endsWith('.test.ts') && (integration || !name.endsWith('.integration.test.ts'))
  )
  .sort()
  .map((name) => `${directory}/${name}`);
const args = [
  '--experimental-transform-types',
  '--import',
  './test-register.mjs',
  '--test',
  ...(process.argv.includes('--coverage') ? ['--experimental-test-coverage', '--test-coverage-include=**/src/modules/demo-store/checkout/*.ts'] : []),
  ...files,
];
const result = spawnSync(process.execPath, args, { cwd: root, env: process.env, stdio: 'inherit' });
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
