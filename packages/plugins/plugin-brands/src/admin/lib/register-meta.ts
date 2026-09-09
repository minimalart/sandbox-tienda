import { registerPluginMeta } from '@minimalart/mercatto-plugin-runtime/admin';

// Version MUST match package.json — bump both together on each release.
// El host consulta esto vía `getPluginMeta('brands')?.version` cuando
// el badge `<ExtensionVersion extension="brands" />` no encuentra la
// clave en `EXTENSION_VERSIONS` (tabla estática in-tree).
registerPluginMeta('brands', { version: '1.0.3' });
