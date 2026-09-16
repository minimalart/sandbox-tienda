/**
 * Subpath `@minimalart/mercatto-plugin-runtime/admin`.
 *
 * Todo lo que se re-exporte acá tiene que ser browser-safe (nada de `node:*`,
 * `process.env` sí porque Vite lo tolera, pero preferentemente evitar). Es el
 * punto de entrada para las UI primitives del contract: slots que el host
 * registra y los plugins publicados renderizan.
 *
 * El backend consume el subpath ROOT del package (`.`), no este. Los dos
 * caminos coexisten en el mismo package para no duplicar la vinculación
 * host↔plugin en varios releases separados.
 */
export { DrawerTabs, DrawerTabPanel } from './drawer-tabs.js';

export {
  SiteScopeBar,
  registerSiteScopeBar,
  type SiteScopeBarProps,
} from './site-scope-bar.js';

export {
  ExtensionVersion,
  registerExtensionVersion,
  type ExtensionVersionProps,
} from './extension-version.js';

export {
  ExtensionSettingsCard,
  registerExtensionSettingsCard,
  type ExtensionSettingsCardProps,
} from './extension-settings-card.js';

export {
  HelpDrawer,
  registerHelpDrawer,
  type HelpDrawerProps,
} from './help-drawer.js';

export {
  SingleColumnLayout,
  registerSingleColumnLayout,
  type SingleColumnLayoutProps,
} from './single-column-layout.js';

export {
  SalesChannelMultiSelect,
  registerSalesChannelMultiSelect,
  type SalesChannelMultiSelectProps,
} from './sales-channel-multiselect.js';

export {
  registerPluginMeta,
  getPluginMeta,
  type PluginMeta,
} from './plugin-meta.js';
