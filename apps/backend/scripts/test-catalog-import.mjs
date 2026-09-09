import { mkdtempSync, writeFileSync, symlinkSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const backend = resolve(fileURLToPath(new URL('..', import.meta.url)));
const databaseUrl = process.env.CATALOG_TEST_DATABASE_URL;
if (!databaseUrl) throw new Error('Set CATALOG_TEST_DATABASE_URL to an isolated catalog_fixture database.');
const url = new URL(databaseUrl);
if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.pathname !== '/catalog_fixture')
  throw new Error('Catalog integration tests require a local catalog_fixture database.');

const fixture = mkdtempSync(join(tmpdir(), 'mercatto-catalog-test-'));
symlinkSync(join(backend, 'node_modules'), join(fixture, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
const hostPackage = JSON.parse(readFileSync(join(backend, 'package.json'), 'utf8'));
writeFileSync(join(fixture, 'package.json'), JSON.stringify({
  name: 'catalog-fixture', version: '1.0.0', private: true,
  dependencies: {
    '@medusajs/medusa': hostPackage.dependencies['@medusajs/medusa'],
    '@medusajs/framework': hostPackage.dependencies['@medusajs/framework'],
  },
}));
writeFileSync(join(fixture, 'tsconfig.json'), JSON.stringify({
  extends: join(backend, 'tsconfig.json'),
  compilerOptions: { incremental: false },
}));
writeFileSync(join(fixture, 'medusa-config.js'), `const { defineConfig } = require('@medusajs/framework/utils');
module.exports = defineConfig({ projectConfig: {
  databaseUrl: process.env.CATALOG_TEST_DATABASE_URL,
  http: { storeCors: '*', adminCors: '*', authCors: '*', jwtSecret: 'catalog-test-only', cookieSecret: 'catalog-test-only' }
}, admin: { disable: true }, modules: {
  catalog_import: { resolve: ${JSON.stringify(join(backend, 'src/modules/store-importer'))} }
} });`);
// pnpm's peer graphs can load several ORM copies into the same fixture process.
// RawQueryFragment uses a per-copy registry; mixed copies turn raw SQL into a
// quoted identifier. Production's npm lock has one host ORM installation.
const hostResolution = join(fixture, 'host-resolution.cjs');
writeFileSync(hostResolution, `const Module = require('node:module');
const host = new Module(${JSON.stringify(join(backend, 'package.json'))});
host.paths = Module._nodeModulePaths(${JSON.stringify(backend)});
const original = Module._resolveFilename;
Module._resolveFilename = function(request, parent, ...args) {
  if (request.startsWith('@mikro-orm/')) {
    return original.call(this, request, host, ...args);
  }
  return original.call(this, request, parent, ...args);
};`);
for (const args of [['db:migrate'], ['exec', join(backend, 'src/scripts/test-catalog-import-fixture.ts')]]) {
  const result = spawnSync(process.execPath, ['--require', hostResolution, join(backend, 'node_modules/@medusajs/cli/cli.js'), ...args], {
    cwd: fixture, stdio: 'inherit', env: { ...process.env, NODE_ENV: 'test' },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
