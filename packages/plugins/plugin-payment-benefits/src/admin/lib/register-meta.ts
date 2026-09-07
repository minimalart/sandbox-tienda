import { registerPluginMeta } from '@minimalart/mercatto-plugin-runtime/admin';

// Version MUST match package.json — bump both together on each release.
// El host consulta esto vía `getPluginMeta('payment-benefits')?.version` cuando
// el badge `<ExtensionVersion extension="payment-benefits" />` no encuentra la
// clave en `EXTENSION_VERSIONS` (tabla estática in-tree).
registerPluginMeta('payment-benefits', { version: '1.0.1' });
