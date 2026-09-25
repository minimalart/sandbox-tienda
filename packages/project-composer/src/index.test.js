const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { composeProject, derivePorts, isInside, validateBlueprint, writeSpaceDesignerIntegrationFiles } = require('./index');
const { resolveProjectSelection } = require('../../project-catalog/src');
const { renderRecommendationCartSlots, renderRecommendationSlots, renderSpaceDesignerSlot } = require('./extension-integrations');

const manifest = {
  project: { name: 'Demo Store', slug: 'demo-store' },
  commerce: { country_code: 'ar', currency_code: 'ars', locale: 'es' },
  template: 'grocery',
  extensions: [],
};

const SOURCE_ROOT = path.resolve(__dirname, '../../..');

// Se derivan del manifest fuente en vez de hardcodear la versión de Medusa: con
// el literal, las asserts negativas (`… === undefined`, `existsSync === false`)
// pasaban vacuamente después de cada bump y dejaban de proteger nada.
const sourcePackage = JSON.parse(fs.readFileSync(path.join(SOURCE_ROOT, 'package.json'), 'utf8'));
const loyaltyPatchKey = Object.keys(sourcePackage.pnpm.patchedDependencies).find((key) =>
  key.startsWith('@medusajs/loyalty-plugin'),
);
const loyaltyPatchFile = sourcePackage.pnpm.patchedDependencies[loyaltyPatchKey];

test('el patch de loyalty lleva la version en el key', () => {
  // pnpm sólo trata el patch como estricto (fallo = error, no warning) cuando el
  // key es `name@version`; sin versión degrada a warn-only y un patch que no
  // aplica pasa desapercibido. Ver getPatchInfo en pnpm.
  assert.match(loyaltyPatchKey, /^@medusajs\/loyalty-plugin@\d+\.\d+\.\d+$/);
  assert.equal(loyaltyPatchFile, `patches/@medusajs__loyalty-plugin@${loyaltyPatchKey.split('@').pop()}.patch`);
});

test('rejects project destinations inside the boilerplate', () => {
  assert.equal(isInside('C:/repo', 'C:/repo/generated'), true);
  assert.equal(isInside('C:/repo', 'C:/projects/store'), false);
});

test('validates a blueprint and derives stable ports', () => {
  assert.equal(validateBlueprint(manifest), manifest);
  assert.deepEqual(derivePorts('demo-store'), derivePorts('demo-store'));
  assert.notEqual(derivePorts('demo-store').backend, derivePorts('other-store').backend);
});

test('generates repeatable independent folders without Git or platform code', async () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'mercatto-composer-'));
  try {
    const sourceRoot = path.resolve(__dirname, '../../..');
    for (const slug of ['generated-one', 'generated-two']) {
      const output = path.join(parent, slug);
      await composeProject({
        sourceRoot, output, allowDirty: true, noStart: true, skipInstall: true,
        manifest: { ...manifest, project: { name: slug, slug } },
      });
      assert.equal(fs.existsSync(path.join(output, '.git')), false);
      assert.equal(fs.existsSync(path.join(output, 'apps/platform')), false);
      assert.deepEqual(fs.readdirSync(path.join(output, 'packages/templates')), ['grocery']);
      const extensionPackages = fs.readdirSync(path.join(output, 'packages/extensions'));
      assert.ok(extensionPackages.includes('b2b'));
      // Los plugins npm no tienen payload duplicado bajo packages/extensions. El
      // composer conserva ahí sólo las extensiones cuyo source sigue embebido.
      const expectedSourcePackages = resolveProjectSelection({ template: 'grocery', extensions: [] })
        .extensions
        .filter((extension) => extension.type !== 'plugin')
        .map((extension) => extension.id)
        .sort();
      assert.deepEqual(extensionPackages.sort(), expectedSourcePackages);
      assert.equal(extensionPackages.includes('banners'), false);
      assert.equal(extensionPackages.includes('fiscal-documentation'), false);
      assert.equal(extensionPackages.includes('ai-assistant'), false);
      assert.ok(extensionPackages.includes('multistore'), 'multistore es required: tiene que llegar siempre');
      assert.equal(extensionPackages.includes('store-importer'), false, 'el importador pertenece a Tiendas, sin paquete adicional');
      const modules = fs.readdirSync(path.join(output, 'apps/backend/src/modules'));
      // site-manager se desmanteló: su módulo ya no existe y no debe reaparecer.
      assert.equal(modules.includes('site-manager'), false);
      assert.ok(modules.includes('banner'));
      // ESTO ES EL CAMBIO DE FONDO DE P1, y esta assert estaba invertida hasta hoy.
      // `demo-store` se BORRABA de todo proyecto de cliente, y por eso el admin del
      // cliente no tenía multitienda y ninguna extensión podía importarlo. Ahora se
      // instala como `multistore`.
      assert.ok(modules.includes('demo-store'), 'el módulo de tiendas tiene que llegar al proyecto del cliente');
      assert.ok(fs.existsSync(path.join(output, 'apps/backend/src/api/admin/sites')), 'faltan las rutas admin de tiendas');

      // Tiendas incluye el flujo de alta y de importación en tiendas existentes.
      assert.ok(fs.existsSync(path.join(output, 'apps/backend/src/modules/store-importer/index.ts')));
      assert.ok(fs.existsSync(path.join(output, 'apps/backend/src/jobs/process-demo-store-imports.ts')));
      assert.ok(fs.existsSync(path.join(output, 'apps/backend/src/jobs/process-catalog-imports.ts')));
      assert.ok(fs.existsSync(path.join(output, 'apps/backend/src/admin/routes/sites/components/store-catalog.tsx')));

      // Infraestructura de plataforma: es CORE, así que tiene que llegar al proyecto
      // del cliente ELIJA LAS EXTENSIONES QUE ELIJA. `resolve-ownership.js` nunca
      // auto-descubre `src/lib/`, y estos paths no están en el `files[]` de ninguna
      // extensión — pero eso hay que sostenerlo, no asumirlo: sin el espejo del
      // catálogo el backend no sabe qué tiene instalado, y sin `seed-operational.ts`
      // el bootstrap del proyecto no puede correr `db:seed`.
      for (const corePath of [
        'apps/backend/src/lib/platform/catalog.json',
        'apps/backend/src/lib/platform/project-metadata.ts',
        'apps/backend/src/api/admin/platform/catalog/route.ts',
        'apps/backend/src/api/admin/platform/change-requests/route.ts',
        'apps/backend/src/scripts/seed-operational.ts',
      ]) {
        assert.equal(fs.existsSync(path.join(output, corePath)), true, `falta ${corePath} en el proyecto generado`);
      }
      // La UI de "Sitio" y su ruta pública se desmantelaron: no deben reaparecer.
      assert.equal(fs.existsSync(path.join(output, 'apps/backend/src/admin/routes/site-manager')), false);
      assert.equal(fs.existsSync(path.join(output, 'apps/backend/src/api/store/site-config')), false);
      const lock = JSON.parse(fs.readFileSync(path.join(output, 'mercatto.lock.json'), 'utf8'));
      assert.ok(lock.managed_files.length > 0);
      const storefrontPackage = JSON.parse(fs.readFileSync(path.join(output, 'apps/storefront/package.json'), 'utf8'));
      assert.match(storefrontPackage.scripts.dev, new RegExp(`-p ${lock.ports.storefront}(?: |$)`));
      const storefrontEnv = fs.readFileSync(path.join(output, 'apps/storefront/.env.local'), 'utf8');
      assert.match(storefrontEnv, /^NEXT_PUBLIC_MEDUSA_BACKEND_URL=http:\/\/localhost:/m);
      const backendPackage = JSON.parse(fs.readFileSync(path.join(output, 'apps/backend/package.json'), 'utf8'));
      assert.match(backendPackage.scripts['start:local'], /dotenv -e \.env/);
      assert.ok(backendPackage.dependencies['@minimalart/mercatto-plugin-banners']);
      const generatedMiddlewares = fs.readFileSync(path.join(output, 'apps/backend/src/api/extension-middlewares.ts'), 'utf8');
      assert.match(generatedMiddlewares, /storeRecurringOrdersMiddlewares/);
      assert.equal(generatedMiddlewares.includes('adminBrandsMiddlewares'), false);
      assert.equal(generatedMiddlewares.includes('storeArcaMiddlewares'), false);
      const generatedHooks = fs.readFileSync(path.join(output, 'apps/backend/src/admin/hooks/api/index.ts'), 'utf8');
      assert.equal(generatedHooks.includes("export * from './brands'"), false);
      const rootPackage = JSON.parse(fs.readFileSync(path.join(output, 'package.json'), 'utf8'));
      assert.equal(rootPackage.pnpm?.patchedDependencies?.[loyaltyPatchKey], undefined);
      assert.equal(fs.existsSync(path.join(output, loyaltyPatchFile)), false);
      // Sacar el patch del manifest y del disco no alcanza: si el bloque queda en
      // el lock apuntando a un archivo borrado —o si se strippean los sufijos
      // `(patch_hash=…)` sin sacar el bloque— el proyecto generado revienta en su
      // propio `pnpm install --frozen-lockfile`. Es exactamente el modo de falla
      // que tenían los literales de versión hardcodeados.
      const generatedLock = fs.readFileSync(path.join(output, 'pnpm-lock.yaml'), 'utf8');
      assert.equal(generatedLock.replace(/\r\n/g, '\n').includes(`'${loyaltyPatchKey}':\n    hash:`), false);
      const sourceLock = fs.readFileSync(path.join(sourceRoot, 'pnpm-lock.yaml'), 'utf8');
      const patchEntries = [...sourceLock.matchAll(/  '([^']+)':\r?\n    hash: ([a-z0-9]+)\r?\n    path: ([^\r\n]+)/g)];
      for (const [, key, hash, file] of patchEntries) {
        const retained = key !== loyaltyPatchKey;
        assert.equal(generatedLock.includes(`(patch_hash=${hash})`), retained, key);
        assert.equal(fs.existsSync(path.join(output, file)), retained, file);
      }
      const compose = fs.readFileSync(path.join(output, 'infra/docker-compose.yml'), 'utf8');
      assert.match(compose, new RegExp(`^name: ${slug}$`, 'm'));
      const appSpec = fs.readFileSync(path.join(output, '.do/app.yaml.example'), 'utf8');
      assert.equal((appSpec.match(/instance_size_slug: apps-s-2vcpu-4gb/g) || []).length, 2);
      assert.match(appSpec, /initial_delay_seconds: 300/);
    }
    assert.notDeepEqual(derivePorts('generated-one'), derivePorts('generated-two'));
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test('includes the loyalty containment patch only when gift-cards is selected', async () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'mercatto-gift-cards-'));
  try {
    const output = path.join(parent, 'gift-card-store');
    await composeProject({
      sourceRoot: path.resolve(__dirname, '../../..'), output, allowDirty: true, noStart: true, skipInstall: true,
      manifest: { ...manifest, project: { name: 'Gift Card Store', slug: 'gift-card-store' }, extensions: ['gift-cards'] },
    });
    const rootPackage = JSON.parse(fs.readFileSync(path.join(output, 'package.json'), 'utf8'));
    assert.ok(rootPackage.pnpm.patchedDependencies[loyaltyPatchKey]);
    assert.equal(fs.existsSync(path.join(output, loyaltyPatchFile)), true);
    // Con gift-cards el lock conserva el patch: es el control positivo de que las
    // asserts negativas del test anterior miran algo que de verdad existe.
    const giftCardLock = fs.readFileSync(path.join(output, 'pnpm-lock.yaml'), 'utf8');
    assert.ok(giftCardLock.includes(`'${loyaltyPatchKey}':`));
    const backendPackage = JSON.parse(fs.readFileSync(path.join(output, 'apps/backend/package.json'), 'utf8'));
    assert.ok(backendPackage.dependencies['@minimalart/mercatto-plugin-gift-cards']);
    assert.equal(fs.existsSync(path.join(output, 'packages/extensions/gift-cards')), false);
    assert.equal(fs.existsSync(path.join(output, 'apps/backend/src/modules/gift-card-experience')), false);
    assert.equal(fs.existsSync(path.join(output, 'apps/backend/src/admin/routes/gift-card-experience/page.tsx')), false);
    assert.equal(fs.existsSync(path.join(output, 'apps/backend/src/jobs/process-gift-card-lifecycle.ts')), false);
    assert.equal(fs.existsSync(path.join(output, 'apps/backend/src/jobs/reconcile-gift-card-usage.ts')), false);
    assert.match(fs.readFileSync(path.join(output, 'apps/storefront/src/modules/products/templates/gift-card-configurator-slot.tsx'), 'utf8'), /giftCardExperienceAvailable = true/);
    // Sin `recommendation-widgets`: el slot tiene que quedar en la variante stub y NO
    // importar nada de `@modules/recommendations`, que el composer borró del snapshot.
    // Es el único guard automático de que un proyecto sin la extensión sigue
    // compilando: `assertRelativeImportsResolve` no lo detecta porque sólo valida
    // imports relativos, y un alias roto explota recién en `next build`.
    const recommendationSlot = fs.readFileSync(path.join(output, 'apps/storefront/src/lib/recommendations-slot.tsx'), 'utf8');
    assert.match(recommendationSlot, /recommendationWidgetsAvailable = false/);
    assert.equal(recommendationSlot.includes('@modules/recommendations'), false);
    // El slot de carrito va aparte porque es `"use client"` y el del PDP es un módulo de
    // servidor: un mismo archivo no puede ser las dos cosas.
    const cartSlot = fs.readFileSync(path.join(output, 'apps/storefront/src/lib/recommendations-cart-slot.tsx'), 'utf8');
    assert.equal(cartSlot.includes('@modules/recommendations'), false);
    assert.match(cartSlot, /export function CartRecommendations/);
    assert.match(cartSlot, /export function FreeShippingBridge/);
    assert.equal(fs.existsSync(path.join(output, 'apps/storefront/src/modules/recommendations')), false);
    // El util compartido ya no se duplica dentro del storefront: el alias apunta
    // al contrato portable que consumen tanto el host como el plugin.
    assert.equal(fs.existsSync(path.join(output, 'apps/storefront/src/lib/util/free-shipping-target.ts')), false);
    const storefrontTsconfig = fs.readFileSync(path.join(output, 'apps/storefront/tsconfig.json'), 'utf8');
    assert.match(storefrontTsconfig, /node_modules\/@minimalart\/mercatto-plugin-storefront-shared\/dist\/util\/free-shipping-target/);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test('recommendation widget slots bind the published storefront plugin', () => {
  const serverSlot = renderRecommendationSlots(['recommendation-widgets']);
  assert.match(serverSlot, /mercatto-plugin-storefront-recommendations\/slots/);
  assert.match(serverSlot, /createGetRecommendations/);
  assert.equal(serverSlot.includes('@modules/recommendations'), false);

  const cartSlot = renderRecommendationCartSlots(['recommendation-widgets']);
  assert.match(cartSlot, /mercatto-plugin-storefront-recommendations\/slots/);
  assert.match(cartSlot, /CardComponent=\{FeaturedProductCard\}/);
  assert.equal(cartSlot.includes('@modules/recommendations'), false);
});

test('space designer selection prunes optional code and keeps core navigation compilable', async () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'mercatto-space-designer-'));
  const definitions = require('./component-definitions')['space-designer'];
  const slotRelative = 'apps/storefront/src/lib/space-designer-slot.ts';
  try {
    for (const enabled of [true, false]) {
      const target = path.join(parent, enabled ? 'selected' : 'omitted');
      for (const relative of [...definitions, 'packages/plugins/plugin-space-designer']) {
        const marker = relative.endsWith('.ts') ? relative : `${relative}/marker.ts`;
        const file = path.join(target, marker);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, 'export const marker = true;\n');
      }
      writeSpaceDesignerIntegrationFiles(target, enabled ? ['space-designer'] : []);
      for (const relative of [...definitions, 'packages/plugins/plugin-space-designer']) {
        assert.equal(fs.existsSync(path.join(target, relative)), enabled, relative);
      }
      const slot = fs.readFileSync(path.join(target, slotRelative), 'utf8');
      assert.equal(slot, renderSpaceDesignerSlot(enabled ? ['space-designer'] : []));
      if (!enabled) {
        assert.equal(slot.includes('@lib/data/space-designer'), false);
        assert.equal(slot.includes('@lib/space-designer/'), false);
        const ts = require('typescript');
        const compiled = ts.transpileModule(slot, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
        const module = { exports: {} };
        new Function('exports', compiled.outputText)(module.exports);
        assert.deepEqual(await module.exports.getSpaceConfigurators(), []);
      }
    }
    const layout = fs.readFileSync(path.join(SOURCE_ROOT, 'apps/storefront/src/app/[countryCode]/(main)/layout.tsx'), 'utf8');
    assert.match(layout, /from ['"]@lib\/space-designer-slot['"]/);
    assert.equal(layout.includes("from '@lib/data/space-designer'"), false);
    const extractor = fs.readFileSync(path.join(__dirname, 'extract-components.js'), 'utf8');
    assert.match(extractor, /renderSpaceDesignerSlot\(allExtensionIds\)/);
  } finally {
    const resolved = path.resolve(parent);
    assert.ok(isInside(os.tmpdir(), resolved) && path.basename(resolved).startsWith('mercatto-space-designer-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  }
});
