import type { ComponentType, ReactElement } from 'react';

/**
 * Slot para el badge de versión + alcance multitienda de una extensión.
 *
 * El componente concreto vive en el host (`apps/backend/src/admin/components/
 * common/extension-version.tsx`) porque lee dos tablas host-locales:
 * `EXTENSION_VERSIONS` y `EXTENSION_MULTISTORE`. Los plugins publicados no
 * pueden importarlas, y duplicarlas en cada plugin es exactamente lo que este
 * contract está para evitar.
 *
 * `extension` es el slug estable de la extensión (`shop-by-looks`,
 * `gift-cards`, `fiscal-documentation`, …). El host lo busca en su registro
 * central; los plugins migrados que todavía no están en `EXTENSION_VERSIONS`
 * empujan su versión vía `registerPluginMeta` — ver `plugin-meta.ts`.
 */
export type ExtensionVersionProps = {
  extension: string;
};

/**
 * Singleton mutable: mismo patrón que `SiteScopeBar`. El bundle del admin es
 * uno solo y pnpm hoistea el runtime a una única ubicación, así que la
 * variable es compartida entre host y plugins.
 */
let RegisteredComponent: ComponentType<ExtensionVersionProps> | null = null;

/**
 * El HOST llama esto al final del archivo donde exporta la implementación:
 *
 *     export const ExtensionVersion = (...) => { ... };
 *     registerExtensionVersion(ExtensionVersion);
 */
export function registerExtensionVersion(
  component: ComponentType<ExtensionVersionProps> | null,
): void {
  RegisteredComponent = component;
}

/**
 * Los PLUGINS renderizan esto en sus admin routes:
 *
 *     import { ExtensionVersion } from '@minimalart/mercatto-plugin-runtime/admin';
 *     <ExtensionVersion extension="shop-by-looks" />
 *
 * Fallback silencioso: si el host todavía no registró, no se renderiza nada.
 * La página sigue funcional, sólo falta el badge por 1 render.
 */
export function ExtensionVersion(props: ExtensionVersionProps): ReactElement | null {
  const Component = RegisteredComponent;
  if (!Component) return null;
  return <Component {...props} />;
}
