import { registerPluginMeta } from '@minimalart/mercatto-plugin-runtime/admin';

// Version MUST match package.json — bump both together on each release.
// El host consulta esto vía `getPluginMeta('banners')?.version` cuando
// el badge `<ExtensionVersion extension="banners" />` no encuentra la
// clave en `EXTENSION_VERSIONS` (tabla estática in-tree).
registerPluginMeta('banners', { version: '1.0.1' });
