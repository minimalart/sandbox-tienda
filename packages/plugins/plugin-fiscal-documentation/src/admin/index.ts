// Side-effect import: pushes this plugin's metadata into the runtime registry
// so the host's `<ExtensionVersion extension="fiscal-documentation" />` can
// render our version + multistore scope (arreglando el bug del badge "v" pelado
// cuando la extensión migrada no está en `EXTENSION_VERSIONS` del host).
import './lib/register-meta';

// Este plugin NO expone rutas ni widgets en el admin — la UI vive en el host
// (`apps/backend/src/admin/routes/store-config/components/fiscal-docs-card.tsx`)
// que consume las rutas del plugin bajo `/admin/fiscal-documents/*`.
//
// El archivo existe por dos motivos que se refuerzan:
//   1. `@medusajs/admin-vite-plugin` necesita un entry point para incluirlo en
//      `__admin-extensions__.js`; sin él, `plugin:build` tira ENOENT.
//   2. El `export {}` mantiene esto como módulo ES (no script), garantizando
//      que el side-effect del import de arriba se evalúe al cargar el bundle.
export {};
