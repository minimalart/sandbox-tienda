import { registerPluginMeta } from '@minimalart/mercatto-plugin-runtime/admin';

// Version MUST match package.json — bump both together on each release.
// El host consulta esto vía `getPluginMeta('shop-by-looks')?.version` cuando
// el badge `<ExtensionVersion extension="shop-by-looks" />` no encuentra la
// clave en `EXTENSION_VERSIONS` (tabla estática in-tree).
registerPluginMeta('shop-by-looks', { version: '1.0.3' });
