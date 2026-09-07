// Side-effect import: pushes this plugin's metadata into the runtime registry
// so the host's `<ExtensionVersion />` can render our version + multistore scope.
import './lib/register-meta';

// Keep an explicit export so @medusajs/admin-vite-plugin picks this up as an
// entry point and evaluates the side-effect import above on bundle load.
export {};
