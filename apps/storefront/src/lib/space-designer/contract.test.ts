import type { SpacePublicConfigurator, SpaceSnapshot } from './types';
import type {
  SpacePublicConfigurator as PluginConfigurator,
  SpaceSnapshot as PluginSnapshot,
} from '../../../../../packages/plugins/plugin-space-designer/src/types';

// Compile-time wire compatibility. Only tests reference the plugin source:
// a generated storefront can consume the published plugin without its repository.
type Assert<T extends true> = T;
type ContractToStorefront = Assert<
  PluginConfigurator extends SpacePublicConfigurator ? true : false
>;
type StorefrontToContract = Assert<
  SpacePublicConfigurator extends PluginConfigurator ? true : false
>;
type SnapshotToContract = Assert<SpaceSnapshot extends PluginSnapshot ? true : false>;
type ContractToSnapshot = Assert<PluginSnapshot extends SpaceSnapshot ? true : false>;
