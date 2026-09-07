import { registerPluginMeta } from '@minimalart/mercatto-plugin-runtime/admin';

// Version MUST match package.json — bump both together on each release.
// El host consulta esto vía `getPluginMeta('gift-cards')?.version` cuando el
// badge `<ExtensionVersion extension="gift-cards" />` no encuentra la clave en
// `EXTENSION_VERSIONS` (tabla estática in-tree).
registerPluginMeta('gift-cards', { version: '1.0.1' });
