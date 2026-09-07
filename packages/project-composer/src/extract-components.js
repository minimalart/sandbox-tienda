const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { resolveOwnership } = require('./resolve-ownership');
const metadata = require('./component-metadata');
const {
  adminHookDefinitions, adminTranslationDefinitions, middlewareDefinitions,
  renderAdminHookIndex, renderAdminI18n, renderExtensionMiddlewares,
  renderGiftCardConfiguratorSlot,
  renderRecommendationSlots,
  renderRecommendationCartSlots,
  renderWhatsappFloatingSlot,
  renderSpaceDesignerSlot,
} = require('./extension-integrations');
const { catalog } = require('../../project-catalog/src');

const root = path.resolve(__dirname, '../../..');
const toPosix = (value) => value.split(path.sep).join('/');
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const visitFiles = (directory) => {
  if (!fs.existsSync(directory)) return [];
  const result = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...visitFiles(absolute));
    else result.push(absolute);
  }
  return result;
};

const definitions = resolveOwnership(catalog);
// Los registros migrados a paquetes npm siguen en el catálogo para que los
// proyectos puedan seleccionarlos, pero ya no tienen un payload bajo
// packages/extensions. Sólo las extensiones source-owned se extraen acá.
const sourceExtensions = catalog.extensions.filter((extension) => extension.type !== 'plugin');
const sourceExtensionIds = sourceExtensions.map((extension) => extension.id);
const allExtensionIds = catalog.extensions.map((extension) => extension.id);
const catalogById = new Map(catalog.extensions.map((extension) => [extension.id, extension]));

fs.writeFileSync(
  path.join(root, 'apps', 'backend', 'src', 'api', 'extension-middlewares.ts'),
  renderExtensionMiddlewares([...sourceExtensionIds, 'demo-creator'])
);
fs.writeFileSync(
  path.join(root, 'apps', 'storefront', 'src', 'modules', 'products', 'templates', 'gift-card-configurator-slot.tsx'),
  renderGiftCardConfiguratorSlot(allExtensionIds)
);
fs.writeFileSync(
  path.join(root, 'apps', 'storefront', 'src', 'lib', 'recommendations-slot.tsx'),
  renderRecommendationSlots(allExtensionIds)
);
fs.writeFileSync(
  path.join(root, 'apps', 'storefront', 'src', 'lib', 'recommendations-cart-slot.tsx'),
  renderRecommendationCartSlots(allExtensionIds)
);
fs.writeFileSync(
  path.join(root, 'apps', 'storefront', 'src', 'lib', 'whatsapp-slot.tsx'),
  renderWhatsappFloatingSlot(allExtensionIds)
);
fs.writeFileSync(
  path.join(root, 'apps', 'storefront', 'src', 'lib', 'space-designer-slot.ts'),
  renderSpaceDesignerSlot(allExtensionIds)
);
fs.writeFileSync(
  path.join(root, 'apps', 'backend', 'src', 'admin', 'i18n', 'index.ts'),
  renderAdminI18n(sourceExtensionIds)
);
fs.writeFileSync(
  path.join(root, 'apps', 'backend', 'src', 'admin', 'hooks', 'api', 'index.ts'),
  renderAdminHookIndex([...sourceExtensionIds, 'demo-creator'])
);

for (const extension of sourceExtensions) {
  const paths = definitions[extension.id];
  if (!paths) throw new Error(`Missing ownership definition for ${extension.id}`);
  const packageRoot = path.join(root, 'packages', 'extensions', extension.id);
  const payload = path.join(packageRoot, 'payload');
  fs.rmSync(payload, { recursive: true, force: true });
  const files = [];
  for (const relative of paths) {
    const source = path.join(root, relative);
    if (!fs.existsSync(source)) continue;
    const target = path.join(payload, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.cpSync(source, target, { recursive: true });
    files.push({ source: `payload/${relative}`, target: relative });
  }
  fs.mkdirSync(packageRoot, { recursive: true });
  const packageDependencies = Object.fromEntries((extension.dependencies || []).map((id) => {
    const dependency = catalogById.get(id);
    if (dependency?.type === 'plugin' && dependency.packageName) {
      return [dependency.packageName, `^${dependency.version}`];
    }
    return [`@repo/extension-${id}`, 'workspace:*'];
  }));
  fs.writeFileSync(path.join(packageRoot, 'package.json'), `${JSON.stringify({
    name: `@repo/extension-${extension.id}`, version: extension.version, private: true,
    description: `${extension.name} component source package`,
    dependencies: packageDependencies,
  }, null, 2)}\n`);
  const managedFiles = visitFiles(payload).map((absolute) => ({
    path: toPosix(path.relative(payload, absolute)),
    sha256: sha256(absolute),
  })).sort((left, right) => left.path.localeCompare(right.path));
  const migrations = managedFiles.filter((file) => /\/migrations\/Migration[^/]+\.(?:ts|js)$/.test(`/${file.path}`));
  const extra = metadata[extension.id] || {};
  fs.writeFileSync(path.join(packageRoot, 'mercatto-component.json'), `${JSON.stringify({
    schema_version: 1, id: extension.id, name: extension.name, version: extension.version,
    kind: 'extension', status: 'ready', dependencies: extension.dependencies || [], incompatibilities: [],
    settings_namespace: `extension:${extension.id}`, environment: extra.environment || [],
    files, migrations: migrations.map((file) => file.path), managed_files: managedFiles,
    integrations: {
      middlewares: middlewareDefinitions[extension.id] || [],
      admin_hooks: adminHookDefinitions[extension.id] || [],
      admin_translation: adminTranslationDefinitions[extension.id] || null,
    },
  }, null, 2)}\n`);
}
console.log(`Extracted ${sourceExtensions.length} extension payloads.`);
