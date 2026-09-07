# Changelog

## 1.0.4 - Fase B: registrar versión del plugin en el runtime contract.

- Empuja `{ version: '1.0.4' }` al registro `registerPluginMeta('fiscal-documentation', ...)` del runtime (`@minimalart/mercatto-plugin-runtime@^0.3.0`). El host tiene un `EXTENSION_VERSIONS` estático que NO conoce las extensiones migradas — el badge `<ExtensionVersion extension="fiscal-documentation" />` que vive en `store-config/components/fiscal-docs-card.tsx` rendereaba `"v"` pelado. Ahora cae a `getPluginMeta('fiscal-documentation')?.version` y muestra la versión real.
- `src/admin/index.ts` agrega `import './lib/register-meta'` como side effect del entry point que Medusa admin-vite-plugin ya usaba para el bundle. El plugin sigue sin exponer rutas propias — su UI vive en el host.

## 1.0.3 - Mover `arca` de `src/modules/` a `src/lib/`.

- 1.0.2 seguía crasheando en el boot con `TypeError: Cannot read properties of undefined (reading 'service')`. El plugin loader de Medusa auto-descubre `src/modules/*/index.ts` y espera que exporte un `Module()`; `arca/index.ts` solo re-exportaba tipos, sin default → el loader intentaba leer `.service` sobre `undefined`.
- ARCA no es un módulo Medusa. Es un cliente WSAA + padrón A5. Movido a `src/lib/arca/` (fuera del path que Medusa scanea). 4 imports actualizados: modules/fiscal-documentation/snapshot.ts + api/{admin/fiscal-documents/route,_helpers,store/arca/taxpayer-lookup/route}.ts.

## 1.0.2 - Fix del boot en el host (rebuild correcto).

- La versión 1.0.1 se publicó con .medusa/server compilado ANTES de agregar `arca/index.ts` (docker publish saltó el install). 1.0.2 reempaqueta el mismo código con el build correcto.

## 1.0.1 - Fix del boot en el host.

- `src/admin/index.ts` placeholder para que `@medusajs/admin-vite-plugin` no tire ENOENT sobre `__admin-extensions__.js` cuando el plugin no expone UI de admin.
- `src/modules/arca/index.ts` que re-exporta el resto del namespace para que el plugin loader de Medusa 2.18 no tire ENOENT sobre `modules/arca/index.js` durante el auto-descubrimiento. ARCA no es un módulo Medusa (es un cliente WSAA + padrón A5), pero al vivir en `src/modules/` el scanner lo pide.
- `fast-xml-parser` y `node-forge` movidos a runtime `dependencies` (los usa el cliente ARCA). `@types/node-forge` agregado a devDeps.

## 1.0.0 - Initial migration from base extension.

All functionality preserved from packages/extensions/fiscal-documentation at parity, with two deliberate simplifications while `app-settings` and `multistore` remain host-only infrastructure:

- ARCA settings (CUIT, environment, WSAA service, cert/key material) fall back to env-only reads, matching pre-`app-settings` behaviour. The per-store DB layer is disabled — every store consults ARCA with the instance identity until the `app-settings` module is plugin-ified.
- ARCA per-store credentials (`site_credential` reader) is stubbed to return `null`. Stores that had loaded their own certificate from the admin credentials screen inherit the instance credentials until the `site_credential` reader is extracted to a shared package.

The `arca` module ships bundled inside this plugin — same manifest as the base extension, which declared `modules/arca` alongside `modules/fiscal-documentation` and `api/admin/fiscal-documents`. The `api/store/arca` route (drift not declared in the base manifest but functionally part of the ARCA bundle) is also moved here, so both admin generation and storefront checkout autocomplete come from the plugin.

The multistore `siteFilter`/`assertIdInSite` shim is vendored from plugin-catalogador (5 files: types, module-key, request, resolve-site, scope). `resolve-site-sql` is replaced by a local shim that returns `registryAbsent`; the `corporate`/`company` site-scope descriptors are inlined in `api/admin/fiscal-documents/_helpers.ts` with `kind: 'site_column'` on `site_id`. `validateCuit` is vendored from `billing-profile/types` into `src/lib/cuit.ts`.

The `descriptors/fiscal-documentation.ts` (app-settings descriptor for the 7 ARCA env vars) and `admin/help/fiscal-documentation.ts` (help drawer text) stay in the host: they own the admin-facing surface (credentials screen, extensions preferences, help drawer) that the plugin cannot register from here.
