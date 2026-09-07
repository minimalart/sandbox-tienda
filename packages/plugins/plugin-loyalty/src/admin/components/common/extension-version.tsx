import { Badge } from '@medusajs/ui';
import pkg from '../../../../package.json';

/**
 * Plugin-local `ExtensionVersion`: shows the plugin package version as a small
 * badge. Standalone replacement for the host-side component that reads a central
 * registry — the plugin can't reach that registry once shipped as an npm package.
 */
type ExtensionVersionProps = {
  extension?: string;
};

const PLUGIN_VERSION = pkg.version;

export const ExtensionVersion = (_props: ExtensionVersionProps) => (
  <Badge size="2xsmall" color="grey" rounded="full" title="Plugin version">
    v{PLUGIN_VERSION}
  </Badge>
);
