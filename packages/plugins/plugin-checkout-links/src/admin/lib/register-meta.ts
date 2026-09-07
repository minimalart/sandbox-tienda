import { registerPluginMeta } from '@minimalart/mercatto-plugin-runtime/admin';

// Version MUST match package.json — bump both together on each release.
// El host consulta esto vía `getPluginMeta('checkout-links')?.version` cuando
// el badge `<ExtensionVersion extension="checkout-links" />` no encuentra la
// clave en `EXTENSION_VERSIONS` (tabla estática in-tree).
registerPluginMeta('checkout-links', { version: '1.0.2' });
