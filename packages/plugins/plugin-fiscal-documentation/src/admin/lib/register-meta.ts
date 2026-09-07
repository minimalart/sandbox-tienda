import { registerPluginMeta } from '@minimalart/mercatto-plugin-runtime/admin';

// Version MUST match package.json — bump both together on each release.
// El host consulta esto vía `getPluginMeta('fiscal-documentation')?.version`
// cuando el badge `<ExtensionVersion extension="fiscal-documentation" />` no
// encuentra la clave en `EXTENSION_VERSIONS` (tabla estática in-tree).
registerPluginMeta('fiscal-documentation', { version: '1.0.4' });
