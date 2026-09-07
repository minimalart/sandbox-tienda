/**
 * Registro runtime de metadata por plugin.
 *
 * ─── POR QUÉ EXISTE ─────────────────────────────────────────────────────────
 *
 * El host tiene un `EXTENSION_VERSIONS` estático en
 * `apps/backend/src/admin/lib/extension-versions.ts` con las versiones de las
 * extensiones IN-TREE. Los plugins publicados (fiscal-documentation,
 * shop-by-looks, gift-cards, …) NO están en esa tabla: sus versiones viven en
 * su propio `package.json` y el host no puede resolverlas en tiempo de bundle
 * porque los plugins pueden actualizarse sin re-desplegar el host.
 *
 * Resultado sin registro: `<ExtensionVersion extension="shop-by-looks" />`
 * lookupeaba `EXTENSION_VERSIONS['shop-by-looks']` → `undefined` → el badge
 * renderizaba `"v"` (la letra pelada). Precedente: el "bug del badge v" que
 * dispara esta migración.
 *
 * ─── CÓMO SE USA ────────────────────────────────────────────────────────────
 *
 * Cada plugin llama `registerPluginMeta` en un side-effect de su bundle:
 *
 *     // packages/plugins/plugin-shop-by-looks/src/admin/lib/register-meta.ts
 *     import { registerPluginMeta } from '@minimalart/mercatto-plugin-runtime/admin';
 *     registerPluginMeta('shop-by-looks', { version: '1.0.1' });
 *
 * El componente `ExtensionVersion` del host consulta primero
 * `EXTENSION_VERSIONS` (extensiones in-tree) y cae a `getPluginMeta(key)?.version`
 * cuando falla — así el badge siempre tiene un valor.
 */

export type PluginMeta = {
  version: string;
};

const registry = new Map<string, PluginMeta>();

export function registerPluginMeta(key: string, meta: PluginMeta): void {
  registry.set(key, meta);
}

export function getPluginMeta(key: string): PluginMeta | undefined {
  return registry.get(key);
}
