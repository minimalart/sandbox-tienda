const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { resolveProjectSelection } = require('../../project-catalog/src');
const componentDefinitions = require('./component-definitions');
const { renderAdminHookIndex, renderAdminI18n, renderExtensionMiddlewares, renderGiftCardConfiguratorSlot, renderRecommendationSlots, renderRecommendationCartSlots, renderWhatsappFloatingSlot, renderSpaceDesignerSlot } = require('./extension-integrations');

const COMPOSER_VERSION = '1.0.0';
const OMIT_NAMES = new Set([
  '.git', '.claude', '.codex', '.turbo', '.next', '.medusa', 'node_modules',
  'dist', 'build', 'playwright-report', 'test-results',
]);
const OMIT_RELATIVE = new Set([
  'apps/platform', 'blueprints', 'packages/project-composer', 'packages/project-catalog',
  'packages/project-creator',
  'apps/mercatto-product-list-video',
]);

function normalizePath(value) {
  return path.resolve(value).replace(/[\\/]+$/, '').toLowerCase();
}

function isInside(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function run(command, args, cwd, options = {}) {
  const isCorepack = command === 'corepack';
  const executable = isCorepack ? process.execPath : command;
  const commandArgs = isCorepack
    ? [path.join(path.dirname(process.execPath), 'node_modules', 'corepack', 'dist', 'corepack.js'), ...args]
    : args;
  const result = spawnSync(executable, commandArgs, {
    cwd,
    stdio: 'inherit',
    shell: false,
    env: { ...process.env, ...options.env },
  });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed with code ${result.status}`);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function collectManagedFiles(targetRoot, selection) {
  const roots = [
    'package.json', 'pnpm-workspace.yaml', 'infra/docker-compose.yml',
    'apps/backend/Dockerfile', '.do/app.yaml.example',
    'apps/backend/medusa-config.ts', 'apps/backend/src/api/extension-middlewares.ts',
    'apps/backend/src/admin/hooks/api/index.ts',
    'apps/backend/src/admin/i18n/index.ts',
    selection.template.source,
  ];
  for (const extension of selection.extensions) {
    if (extension.type === 'plugin') continue;
    const manifestPath = path.join(targetRoot, 'packages', 'extensions', extension.id, 'mercatto-component.json');
    if (fs.existsSync(manifestPath)) roots.push(...readJson(manifestPath).files.map((file) => file.target));
  }
  const files = [];
  const visit = (relative) => {
    const absolute = path.join(targetRoot, relative);
    if (!fs.existsSync(absolute)) return;
    const stat = fs.statSync(absolute);
    if (stat.isDirectory()) {
      for (const child of fs.readdirSync(absolute)) visit(path.join(relative, child));
    } else files.push({ path: relative.split(path.sep).join('/'), sha256: sha256File(absolute) });
  };
  roots.forEach(visit);
  return files.sort((left, right) => left.path.localeCompare(right.path));
}

function git(sourceRoot, args) {
  const result = spawnSync('git', args, { cwd: sourceRoot, encoding: 'utf8', shell: false });
  if (result.status !== 0) throw new Error(result.stderr?.trim() || `git ${args.join(' ')} failed`);
  return result.stdout.trim();
}

function assertCleanSource(sourceRoot, allowDirty) {
  const commit = git(sourceRoot, ['rev-parse', 'HEAD']);
  const status = git(sourceRoot, ['status', '--porcelain']);
  if (status && !allowDirty) {
    throw new Error('The boilerplate has uncommitted changes. Commit them before generating a project.');
  }
  return { commit, dirty: Boolean(status) };
}

function validateBlueprint(input) {
  if (!input || typeof input !== 'object') throw new Error('Project manifest must be an object.');
  const project = input.project || {};
  if (!project.name || typeof project.name !== 'string') throw new Error('project.name is required.');
  if (!/^[a-z][a-z0-9-]{1,30}$/.test(project.slug || '')) {
    throw new Error('project.slug must start with a letter and contain 2-31 lowercase characters, digits or hyphens.');
  }
  if (!/^[a-z]{2}$/.test(input.commerce?.country_code || '')) throw new Error('commerce.country_code must be ISO-2 lowercase.');
  if (!/^[a-z]{3}$/.test(input.commerce?.currency_code || '')) throw new Error('commerce.currency_code must be ISO-3 lowercase.');
  resolveProjectSelection({ template: input.template, extensions: input.extensions || [] });
  return input;
}

function derivePorts(slug) {
  const offset = Number.parseInt(crypto.createHash('sha1').update(slug).digest('hex').slice(0, 4), 16) % 300;
  return {
    storefront: 3000 + offset,
    backend: 9000 + offset,
    postgres: 5433 + offset,
    redis: 6380 + offset,
    typesense: 8109 + offset,
  };
}

function shouldCopy(sourceRoot, absolutePath) {
  const relative = path.relative(sourceRoot, absolutePath).split(path.sep).join('/');
  if (!relative) return true;
  if (relative === 'coverage' || relative.startsWith('coverage/')) return false;
  const parts = relative.split('/');
  if (parts.some((part) => OMIT_NAMES.has(part))) return false;
  if (OMIT_RELATIVE.has(relative) || [...OMIT_RELATIVE].some((item) => relative.startsWith(`${item}/`))) return false;
  if (/^\.env(?:\.|$)/.test(path.basename(absolutePath)) && !path.basename(absolutePath).includes('example')) return false;
  if (/\.(log|tsbuildinfo)$/.test(relative)) return false;
  return true;
}

function copySource(sourceRoot, targetRoot) {
  const result = spawnSync('git', ['ls-files', '-c', '-o', '--exclude-standard', '-z'], {
    cwd: sourceRoot, encoding: 'utf8', shell: false, maxBuffer: 50 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(result.stderr?.trim() || 'Unable to list boilerplate files');
  for (const relative of result.stdout.split('\0').filter(Boolean)) {
    const source = path.join(sourceRoot, relative);
    if (!shouldCopy(sourceRoot, source) || !fs.existsSync(source) || fs.statSync(source).isDirectory()) continue;
    const target = path.join(targetRoot, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
  }
}

function pruneComponentPackages(targetRoot, selection) {
  const templatesRoot = path.join(targetRoot, 'packages', 'templates');
  if (fs.existsSync(templatesRoot)) {
    for (const entry of fs.readdirSync(templatesRoot)) {
      if (entry !== selection.template.id) fs.rmSync(path.join(templatesRoot, entry), { recursive: true, force: true });
    }
  }
  const selectedExtensions = new Set(selection.extensions.map((extension) => extension.id));
  const extensionsRoot = path.join(targetRoot, 'packages', 'extensions');
  if (fs.existsSync(extensionsRoot)) {
    for (const entry of fs.readdirSync(extensionsRoot)) {
      if (!selectedExtensions.has(entry)) fs.rmSync(path.join(extensionsRoot, entry), { recursive: true, force: true });
    }
  }
}

function removeEmbeddedExtensionSources(targetRoot) {
  const targets = [];
  const extensionsRoot = path.join(targetRoot, 'packages', 'extensions');
  if (fs.existsSync(extensionsRoot)) {
    for (const entry of fs.readdirSync(extensionsRoot)) {
      const manifestPath = path.join(extensionsRoot, entry, 'mercatto-component.json');
      if (!fs.existsSync(manifestPath)) continue;
      targets.push(...(readJson(manifestPath).files || []).map((file) => file.target));
    }
  }
  for (const relative of new Set(targets)) {
    fs.rmSync(path.join(targetRoot, relative), { recursive: true, force: true });
  }
}

function installSelectedExtensionPayloads(targetRoot, selection) {
  for (const extension of selection.extensions) {
    // Los plugins npm ya encapsulan sus rutas, middlewares, admin y migraciones.
    // No tienen (ni deben recrear) un payload bajo packages/extensions.
    if (extension.type === 'plugin') continue;
    const packageRoot = path.join(targetRoot, 'packages', 'extensions', extension.id);
    const manifest = readJson(path.join(packageRoot, 'mercatto-component.json'));
    for (const file of manifest.files || []) {
      const source = path.join(packageRoot, file.source);
      const target = path.join(targetRoot, file.target);
      if (!fs.existsSync(source)) throw new Error(`Missing component payload: ${extension.id}/${file.source}`);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.cpSync(source, target, { recursive: true });
    }
  }
}

function writeExtensionIntegrationFiles(targetRoot, selection) {
  const ids = selection.extensions.map((extension) => extension.id);
  const sourceIds = selection.extensions
    .filter((extension) => extension.type !== 'plugin')
    .map((extension) => extension.id);
  fs.writeFileSync(
    path.join(targetRoot, 'apps', 'backend', 'src', 'api', 'extension-middlewares.ts'),
    renderExtensionMiddlewares(sourceIds)
  );
  fs.writeFileSync(
    path.join(targetRoot, 'apps', 'backend', 'src', 'admin', 'hooks', 'api', 'index.ts'),
    renderAdminHookIndex(sourceIds)
  );
  fs.writeFileSync(
    path.join(targetRoot, 'apps', 'backend', 'src', 'admin', 'i18n', 'index.ts'),
    renderAdminI18n(sourceIds)
  );
  fs.writeFileSync(
    path.join(targetRoot, 'apps', 'storefront', 'src', 'modules', 'products', 'templates', 'gift-card-configurator-slot.tsx'),
    renderGiftCardConfiguratorSlot(ids)
  );
  fs.writeFileSync(
    path.join(targetRoot, 'apps', 'storefront', 'src', 'lib', 'recommendations-slot.tsx'),
    renderRecommendationSlots(ids)
  );
  fs.writeFileSync(
    path.join(targetRoot, 'apps', 'storefront', 'src', 'lib', 'recommendations-cart-slot.tsx'),
    renderRecommendationCartSlots(ids)
  );
  fs.writeFileSync(
    path.join(targetRoot, 'apps', 'storefront', 'src', 'lib', 'whatsapp-slot.tsx'),
    renderWhatsappFloatingSlot(ids)
  );
  writeSpaceDesignerIntegrationFiles(targetRoot, ids);
}

function writeSpaceDesignerIntegrationFiles(targetRoot, ids) {
  // Npm plugins have no packages/extensions payload to prune. Remove this
  // optional storefront adapter explicitly while retaining its core slot.
  if (!ids.includes('space-designer')) {
    const ownedPaths = [
      ...componentDefinitions['space-designer'],
      'packages/plugins/plugin-space-designer',
    ];
    for (const relative of ownedPaths) {
      const absolute = path.resolve(targetRoot, relative);
      if (!isInside(targetRoot, absolute) || absolute === path.resolve(targetRoot)) {
        throw new Error(`Unsafe Space Designer ownership path: ${relative}`);
      }
      fs.rmSync(absolute, { recursive: true, force: true });
    }
  }
  const slotPath = path.join(targetRoot, 'apps', 'storefront', 'src', 'lib', 'space-designer-slot.ts');
  fs.mkdirSync(path.dirname(slotPath), { recursive: true });
  fs.writeFileSync(slotPath, renderSpaceDesignerSlot(ids));
}

function assertRelativeImportsResolve(root) {
  if (!fs.existsSync(root)) return;
  const files = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (/\.(?:ts|tsx|js|jsx)$/.test(entry.name)) files.push(absolute);
    }
  };
  visit(root);
  const missing = [];
  const importPattern = /(?:from\s+|import\s*)['"](\.[^'"]+)['"]/g;
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    for (const match of content.matchAll(importPattern)) {
      const base = path.resolve(path.dirname(file), match[1]);
      const candidates = [
        base,
        ...['.ts', '.tsx', '.js', '.jsx', '.json'].map((extension) => `${base}${extension}`),
        ...['index.ts', 'index.tsx', 'index.js', 'index.jsx'].map((name) => path.join(base, name)),
      ];
      if (!candidates.some((candidate) => fs.existsSync(candidate))) {
        missing.push(`${path.relative(root, file)} -> ${match[1]}`);
      }
    }
  }
  if (missing.length) throw new Error(`Generated source has unresolved relative imports:\n${missing.join('\n')}`);
}

function replaceEnv(content, values) {
  const seen = new Set();
  const lines = content.split(/\r?\n/).map((line) => {
    const match = /^([A-Z0-9_]+)=/.exec(line);
    if (!match || !(match[1] in values)) return line;
    seen.add(match[1]);
    return `${match[1]}=${values[match[1]]}`;
  });
  for (const [key, value] of Object.entries(values)) if (!seen.has(key)) lines.push(`${key}=${value}`);
  return `${lines.join(os.EOL).replace(/\s+$/, '')}${os.EOL}`;
}

const LOYALTY_PATCH_PACKAGE = '@medusajs/loyalty-plugin';

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Resolves the loyalty patch entry from the root manifest instead of hardcoding
 * the Medusa version. The `patchedDependencies` key carries the version on
 * purpose — pnpm only treats a patch as strict (failure = error, not warning)
 * when the key is `name@version` — so every Medusa bump used to change it, and
 * the hardcoded literals here silently stopped matching: `rmSync` with `force`
 * no-oped and the lockfile regex missed, shipping generated projects whose
 * pnpm-lock.yaml still declared a patch file that had been deleted.
 */
function findLoyaltyPatch(rootPackage) {
  const patched = rootPackage.pnpm?.patchedDependencies;
  if (!patched) return null;
  const keys = Object.keys(patched).filter(
    (key) => key === LOYALTY_PATCH_PACKAGE || key.startsWith(`${LOYALTY_PATCH_PACKAGE}@`),
  );
  if (keys.length > 1) {
    throw new Error(`multiple ${LOYALTY_PATCH_PACKAGE} patch keys: ${keys.join(', ')}`);
  }
  if (keys.length === 0) return null;
  return { key: keys[0], file: patched[keys[0]], total: Object.keys(patched).length };
}

function configureProject(targetRoot, blueprint, selection, sourceState) {
  const ports = { ...derivePorts(blueprint.project.slug), ...(blueprint.local_ports || {}) };
  const rootPackagePath = path.join(targetRoot, 'package.json');
  const rootPackage = readJson(rootPackagePath);
  rootPackage.name = `@${blueprint.project.slug}/monorepo`;
  rootPackage.description = `${blueprint.project.name} - generated Mercatto Medusa project`;
  delete rootPackage.scripts['site:create'];
  delete rootPackage.scripts['site:catalog:validate'];
  // The loyalty patch is part of gift-cards containment, not global boilerplate
  // behavior. Generated projects without the extension get the stock package.
  if (!selection.extensions.some((extension) => extension.id === 'gift-cards')) {
    const patch = findLoyaltyPatch(rootPackage);
    if (patch) {
      // The `(patch_hash=…)` strip below is global, so it is only correct while
      // the boilerplate ships exactly one patch.
      if (patch.total !== 1) {
        throw new Error(
          `expected exactly 1 pnpm.patchedDependencies entry, found ${patch.total}: the global ` +
            `(patch_hash=…) strip would corrupt the other patches' lockfile entries`,
        );
      }
      delete rootPackage.pnpm.patchedDependencies[patch.key];
      if (Object.keys(rootPackage.pnpm.patchedDependencies).length === 0) {
        delete rootPackage.pnpm.patchedDependencies;
      }

      // No `force`: a missing patch file means the snapshot drifted from the
      // manifest, and silently skipping leaves the generated lockfile pointing
      // at a file that does not exist.
      const patchFile = path.join(targetRoot, patch.file);
      if (!fs.existsSync(patchFile)) {
        throw new Error(`pnpm.patchedDependencies declares ${patch.file}, missing from the snapshot`);
      }
      fs.rmSync(patchFile);

      const pnpmLockPath = path.join(targetRoot, 'pnpm-lock.yaml');
      const before = fs.readFileSync(pnpmLockPath, 'utf8');
      const block = new RegExp(
        `\\r?\\npatchedDependencies:\\r?\\n  '${escapeRegExp(patch.key)}':\\r?\\n` +
          `    hash: [^\\r\\n]+\\r?\\n    path: ${escapeRegExp(patch.file)}\\r?\\n`,
      );
      if (!block.test(before)) {
        throw new Error(
          `pnpm-lock.yaml has no patchedDependencies block for ${patch.key}: stripping only the ` +
            `(patch_hash=…) suffixes would leave the lockfile internally inconsistent`,
        );
      }
      const after = before.replace(block, '\n').replace(/\(patch_hash=[a-z0-9]+\)/g, '');
      if (/patchedDependencies:|\(patch_hash=/.test(after)) {
        throw new Error('pnpm-lock.yaml still references a patch after stripping');
      }
      fs.writeFileSync(pnpmLockPath, after);
    }
  }
  writeJson(rootPackagePath, rootPackage);

  const backendPackagePath = path.join(targetRoot, 'apps/backend/package.json');
  const backendPackage = readJson(backendPackagePath);
  backendPackage.scripts['db:seed'] = 'dotenv -e .env -- medusa exec ./src/scripts/seed-operational.ts';
  backendPackage.scripts['start:local'] = 'dotenv -e .env -- cross-env NODE_ENV=production medusa start';
  writeJson(backendPackagePath, backendPackage);

  const storefrontPackagePath = path.join(targetRoot, 'apps/storefront/package.json');
  const storefrontPackage = readJson(storefrontPackagePath);
  storefrontPackage.scripts.dev = `next dev -p ${ports.storefront} --turbopack`;
  storefrontPackage.scripts['dev:webpack'] = `next dev -p ${ports.storefront}`;
  storefrontPackage.scripts.start = `next start -p ${ports.storefront}`;
  writeJson(storefrontPackagePath, storefrontPackage);

  const composeFile = path.join(targetRoot, 'infra', 'docker-compose.yml');
  let compose = fs.readFileSync(composeFile, 'utf8');
  compose = `name: ${blueprint.project.slug}\n${compose}`
    .replace(/container_name: b2c-/g, `container_name: ${blueprint.project.slug}-`)
    .replace(/\s+profiles: \['docker-db'\]\r?\n/, '\n')
    .replace(/'5432:5432'/, `'${ports.postgres}:5432'`)
    .replace(/'6379:6379'/, `'${ports.redis}:6379'`)
    .replace(/'8108:8108'/, `'${ports.typesense}:8108'`)
    .replace(/b2c-network/g, `${blueprint.project.slug}-network`);
  fs.writeFileSync(composeFile, compose);

  const backendExample = fs.readFileSync(path.join(targetRoot, 'apps/backend/.env.example'), 'utf8');
  const backendEnv = replaceEnv(backendExample, {
    DATABASE_URL: `postgresql://postgres:postgres@localhost:${ports.postgres}/mercatto`,
    REDIS_URL: `redis://localhost:${ports.redis}`,
    JWT_SECRET: crypto.randomBytes(32).toString('hex'),
    COOKIE_SECRET: crypto.randomBytes(32).toString('hex'),
    // Generated as its own value, never derived from JWT_SECRET. The key chain in
    // apps/backend/src/lib/shared/encryption-key.ts falls back to JWT_SECRET when
    // this is missing, so a generated project without it would tie every stored
    // credential to the session signing key: rotating that key to log everyone out
    // would also make the encrypted credentials unreadable, with no error at boot.
    CREDENTIAL_ENCRYPTION_KEY: crypto.randomBytes(32).toString('hex'),
    STORE_CORS: `http://localhost:${ports.storefront}`,
    ADMIN_CORS: `http://localhost:${ports.backend}`,
    AUTH_CORS: `http://localhost:${ports.storefront},http://localhost:${ports.backend}`,
    PORT: String(ports.backend),
    ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'admin@example.com',
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'change-me-before-first-start',
    TYPESENSE_PORT: String(ports.typesense),
    BACKEND_URL: `http://localhost:${ports.backend}`,
    VITE_STOREFRONT_URL: `http://localhost:${ports.storefront}`,
    MERCATTO_PROJECT_ID: blueprint.project.slug,
  });
  fs.writeFileSync(path.join(targetRoot, 'apps/backend/.env'), backendEnv);

  const storefrontExamplePath = path.join(targetRoot, 'apps/storefront/.env.example');
  // Some templates intentionally omit a public storefront env example. The
  // generated project still needs a deterministic local contract, and
  // replaceEnv appends every required value when the baseline is empty.
  const storefrontExample = fs.existsSync(storefrontExamplePath)
    ? fs.readFileSync(storefrontExamplePath, 'utf8')
    : '';
  fs.writeFileSync(path.join(targetRoot, 'apps/storefront/.env.local'), replaceEnv(storefrontExample, {
    NEXT_PUBLIC_BASE_URL: `http://localhost:${ports.storefront}`,
    NEXT_PUBLIC_MEDUSA_BACKEND_URL: `http://localhost:${ports.backend}`,
    NEXT_PUBLIC_COUNTRY_CODE: blueprint.commerce.country_code,
    NEXT_PUBLIC_DEFAULT_REGION: blueprint.commerce.country_code,
    NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY: 'pk_pending_operational_seed',
    NEXT_PUBLIC_SALES_CHANNEL_ID: 'sc_pending_operational_seed',
    NEXT_PUBLIC_TYPESENSE_NODE_PORT: String(ports.typesense),
  }));

  const generated = {
    schema_version: 1,
    project: blueprint.project,
    commerce: blueprint.commerce,
    branding: blueprint.branding || {},
    template: selection.template.id,
    extensions: selection.extensions.map((item) => item.id),
  };
  writeJson(path.join(targetRoot, 'site.project.json'), generated);
  const lockPath = path.join(targetRoot, 'mercatto.lock.json');
  writeJson(lockPath, {
    schema_version: 1,
    composer_version: COMPOSER_VERSION,
    source: sourceState,
    generated_at: new Date().toISOString(),
    composition_mode: 'source-snapshot',
    template: { id: selection.template.id, version: selection.template.version },
    extensions: selection.extensions.map(({ id, version, status }) => ({ id, version, status, active: true })),
    ports,
  });
  writeDeploymentFiles(targetRoot, blueprint);
  const lock = readJson(lockPath);
  lock.managed_files = collectManagedFiles(targetRoot, selection);
  writeJson(lockPath, lock);
}

function writeDeploymentFiles(targetRoot, blueprint) {
  const dockerfile = `FROM node:20-bookworm-slim AS build\nWORKDIR /app\nRUN corepack enable\nCOPY . .\nRUN pnpm install --frozen-lockfile\nRUN pnpm --filter @repo/backend build\n\nFROM node:20-bookworm-slim\nWORKDIR /app\nENV NODE_ENV=production\nRUN corepack enable\nCOPY --from=build /app /app\nEXPOSE 9000\nCMD [\"pnpm\", \"--filter\", \"@repo/backend\", \"start:no-migrate\"]\n`;
  fs.writeFileSync(path.join(targetRoot, 'apps/backend/Dockerfile'), dockerfile);

  const appSpec = `# Copy to .do/app.yaml after replacing placeholders. No secret belongs in Git.\nname: ${blueprint.project.slug}-backend\nregion: nyc\nalerts:\n  - rule: DEPLOYMENT_FAILED\nservices:\n  - name: backend\n    github:\n      repo: OWNER/REPOSITORY\n      branch: main\n      deploy_on_push: true\n    source_dir: /\n    dockerfile_path: apps/backend/Dockerfile\n    http_port: 9000\n    instance_count: 1\n    instance_size_slug: apps-s-1vcpu-2gb\n    health_check:\n      http_path: /health\n      initial_delay_seconds: 30\n      period_seconds: 10\n    envs:\n      - { key: NODE_ENV, value: production, scope: RUN_TIME }\n      - { key: DATABASE_URL, value: REPLACE_IN_DIGITALOCEAN, type: SECRET, scope: RUN_TIME }\n      - { key: DATABASE_SSL, value: \"true\", scope: RUN_TIME }\n      - { key: REDIS_URL, value: REPLACE_WITH_TLS_VALKEY_URL, type: SECRET, scope: RUN_TIME }\n      - { key: WORKFLOW_ENGINE_REDIS, value: REPLACE_WITH_TLS_VALKEY_URL, type: SECRET, scope: RUN_TIME }\n      - { key: JWT_SECRET, value: REPLACE_IN_DIGITALOCEAN, type: SECRET, scope: RUN_TIME }\n      - { key: COOKIE_SECRET, value: REPLACE_IN_DIGITALOCEAN, type: SECRET, scope: RUN_TIME }\n      # Dedicated KEK for everything the backend encrypts at rest (per-store\n      # integration credentials and secret app settings). It MUST be its own value:\n      # without it the key chain falls back to JWT_SECRET, and rotating JWT_SECRET —\n      # the standard move to invalidate every session — silently turns every stored\n      # credential into undecryptable ciphertext. Generate 32 random bytes and never\n      # drop it once anything has been written with it.\n      - { key: CREDENTIAL_ENCRYPTION_KEY, value: REPLACE_IN_DIGITALOCEAN, type: SECRET, scope: RUN_TIME }\n      - { key: STORE_CORS, value: https://STOREFRONT_DOMAIN, scope: RUN_TIME }\n      - { key: ADMIN_CORS, value: https://BACKEND_DOMAIN, scope: RUN_TIME }\n      - { key: AUTH_CORS, value: https://STOREFRONT_DOMAIN,https://BACKEND_DOMAIN, scope: RUN_TIME }\n      - { key: BACKEND_URL, value: https://BACKEND_DOMAIN, scope: RUN_TIME }\n      - { key: STOREFRONT_URL, value: https://STOREFRONT_DOMAIN, scope: RUN_TIME }\n      - { key: TYPESENSE_HOST, value: TYPESENSE_HOST, scope: RUN_TIME }\n      - { key: TYPESENSE_PORT, value: \"443\", scope: RUN_TIME }\n      - { key: TYPESENSE_PROTOCOL, value: https, scope: RUN_TIME }\n      - { key: TYPESENSE_API_KEY, value: REPLACE_IN_DIGITALOCEAN, type: SECRET, scope: RUN_TIME }\n      - { key: S3_ENDPOINT, value: https://REGION.digitaloceanspaces.com, scope: RUN_TIME }\n      - { key: S3_REGION, value: REGION, scope: RUN_TIME }\n      - { key: S3_BUCKET, value: SPACE_NAME, scope: RUN_TIME }\n      - { key: S3_ACCESS_KEY_ID, value: REPLACE_IN_DIGITALOCEAN, type: SECRET, scope: RUN_TIME }\n      - { key: S3_SECRET_ACCESS_KEY, value: REPLACE_IN_DIGITALOCEAN, type: SECRET, scope: RUN_TIME }\njobs:\n  - name: migrate\n    kind: PRE_DEPLOY\n    github:\n      repo: OWNER/REPOSITORY\n      branch: main\n    source_dir: /\n    dockerfile_path: apps/backend/Dockerfile\n    run_command: pnpm --filter @repo/backend migrate\n`;
  const productionAppSpec = appSpec
    .replace('instance_size_slug: apps-s-1vcpu-2gb', 'instance_size_slug: apps-s-2vcpu-4gb')
    .replace('initial_delay_seconds: 30', 'initial_delay_seconds: 300')
    .replace(
      '    run_command: pnpm --filter @repo/backend migrate\n',
      '    instance_size_slug: apps-s-2vcpu-4gb\n    run_command: pnpm --filter @repo/backend migrate\n'
    );
  fs.mkdirSync(path.join(targetRoot, '.do'), { recursive: true });
  fs.writeFileSync(path.join(targetRoot, '.do/app.yaml.example'), productionAppSpec);
  fs.mkdirSync(path.join(targetRoot, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(targetRoot, 'docs/deploy-digitalocean.md'), `# Deploy the Medusa backend to DigitalOcean\n\nThe storefront is not deployed by this App Spec.\n\n## One-time setup\n\n1. Run \`git init\`, create a GitHub repository, commit, and push \`main\`.\n2. Create Managed PostgreSQL. Copy its private connection URL into the encrypted \`DATABASE_URL\` variable.\n3. Create Managed Valkey. Use its TLS URL for both \`REDIS_URL\` and \`WORKFLOW_ENGINE_REDIS\`.\n4. Provision persistent Typesense and configure its HTTPS host and secret API key.\n5. Create a Space and access key. Spaces uses the S3-compatible variables included in the example.\n6. Copy \`.do/app.yaml.example\` to \`.do/app.yaml\`, replace OWNER/REPOSITORY, domains, region, and resource placeholders.\n7. Enter every secret in DigitalOcean as an encrypted value. Never commit real values.\n8. Import the App Spec. The PRE_DEPLOY job completes Medusa migrations before a new backend starts.\n\n## Required runtime values\n\n\`DATABASE_URL\`, \`REDIS_URL\`, \`WORKFLOW_ENGINE_REDIS\`, \`JWT_SECRET\`, \`COOKIE_SECRET\`, \`CREDENTIAL_ENCRYPTION_KEY\` (dedicated encryption key: never reuse \`JWT_SECRET\`, and never remove it once credentials have been saved), \`STORE_CORS\`, \`ADMIN_CORS\`, \`AUTH_CORS\`, \`BACKEND_URL\`, Typesense variables, and S3/Spaces variables. Platform credentials are optional: \`MERCATTO_PLATFORM_URL\`, \`MERCATTO_PROJECT_ID\`, and encrypted \`MERCATTO_PROJECT_SECRET\`. Provider-specific extensions may require additional secrets.\n\n## External storefront\n\nConfigure the hosting provider with the public backend URL, publishable key produced by the operational seed, country/locale, public Typesense search key, and authentication callback URLs. Add its exact origin to \`STORE_CORS\` and \`AUTH_CORS\`.\n\n## Release behavior\n\nPushes to \`main\` deploy automatically. Extension changes arrive through reviewed pull requests; merging one triggers the same validation and deployment path. Check \`/health\` after every release.\n`);

  const workflow = `name: Validate generated project\n\non:\n  pull_request:\n  push:\n    branches: [main]\n\njobs:\n  validate:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: pnpm/action-setup@v4\n        with:\n          version: 9.12.3\n      - uses: actions/setup-node@v4\n        with:\n          node-version: 20\n          cache: pnpm\n      - run: pnpm install --frozen-lockfile\n      - run: pnpm typecheck\n      - run: pnpm build\n`;
  fs.mkdirSync(path.join(targetRoot, '.github/workflows'), { recursive: true });
  fs.writeFileSync(path.join(targetRoot, '.github/workflows/validate-project.yml'), workflow);
}

async function waitForUrl(url, attempts = Number(process.env.SITE_CREATE_HEALTH_ATTEMPTS || 450)) {
  for (let index = 0; index < attempts; index += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function bootstrap(targetRoot, lock, options) {
  if (!options.skipInstall) {
    run('corepack', ['pnpm', 'install'], targetRoot);
    run('corepack', ['pnpm', 'typecheck'], targetRoot);
    run('corepack', ['pnpm', 'build'], targetRoot);
  }
  if (options.noStart || options.skipInstall) return;
  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD are required to bootstrap the generated project.');
  }
  run('corepack', ['pnpm', 'dx:services'], targetRoot);
  run('corepack', ['pnpm', 'setup:db'], targetRoot);
  const child = spawn(process.execPath, [path.join(path.dirname(process.execPath), 'node_modules', 'corepack', 'dist', 'corepack.js'), 'pnpm', 'dev'], {
    cwd: targetRoot,
    shell: false,
    stdio: 'inherit',
  });
  const stop = () => child.kill('SIGTERM');
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  await Promise.all([
    waitForUrl(`http://localhost:${lock.ports.backend}/health`),
    waitForUrl(`http://localhost:${lock.ports.storefront}`),
  ]);
  console.log('Generated project is running. Press Ctrl+C to stop it.');
  await new Promise((resolve, reject) => {
    child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`Development server exited with code ${code}`)));
  });
}

async function composeProject({ sourceRoot, output, manifest, allowDirty = false, noStart = false, skipInstall = false }) {
  sourceRoot = path.resolve(sourceRoot);
  output = path.resolve(output);
  validateBlueprint(manifest);
  if (isInside(sourceRoot, output)) throw new Error('Output must be outside the boilerplate directory.');
  if (fs.existsSync(output) && fs.readdirSync(output).length > 0) throw new Error('Output directory must not exist or must be empty.');

  const sourceState = assertCleanSource(sourceRoot, allowDirty);
  const selection = resolveProjectSelection({ template: manifest.template, extensions: manifest.extensions || [] });
  const tempRoot = `${output}.mercatto-tmp-${process.pid}-${Date.now()}`;
  fs.rmSync(tempRoot, { recursive: true, force: true });
  try {
    copySource(sourceRoot, tempRoot);
    removeEmbeddedExtensionSources(tempRoot);
    pruneComponentPackages(tempRoot, selection);
    installSelectedExtensionPayloads(tempRoot, selection);
    writeExtensionIntegrationFiles(tempRoot, selection);
    assertRelativeImportsResolve(path.join(tempRoot, 'apps', 'backend', 'src', 'admin'));
    configureProject(tempRoot, manifest, selection, sourceState);
    if (fs.existsSync(output)) fs.rmSync(output, { recursive: true, force: true });
    fs.renameSync(tempRoot, output);
    const lock = readJson(path.join(output, 'mercatto.lock.json'));
    await bootstrap(output, lock, { noStart, skipInstall });
    return { output, lock };
  } catch (error) {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    if (fs.existsSync(output)) fs.rmSync(output, { recursive: true, force: true });
    throw error;
  }
}

module.exports = { assertRelativeImportsResolve, composeProject, derivePorts, isInside, validateBlueprint, writeSpaceDesignerIntegrationFiles };
