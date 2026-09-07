import type { ComponentType, ReactElement } from 'react';

/**
 * Props del slot `ExtensionSettingsCard`.
 *
 * Espejan la firma del componente concreto que vive en el host
 * (`apps/backend/src/admin/components/app-settings/extension-settings-card.tsx`).
 * Cualquier cambio de firma acá es breaking para los plugins que lo consumen
 * y para el registrador del host — por eso está tipada acá y no en el host.
 *
 * `namespace` es el `settings_namespace` del manifest del plugin
 * (`extension:gift-cards`, `extension:typesense`, …). El host lo busca en su
 * registro de descriptors y renderiza la card completa (título, fields,
 * validaciones, footer con Guardar/Descartar).
 */
export type ExtensionSettingsCardProps = {
  namespace: string;
  groups?: string[];
  only?: string[];
  title?: string;
  description?: string;
  hideHeader?: boolean;
  hideEnvOnly?: boolean;
  hideSiteContext?: boolean;
  onSaved?: () => void;
};

/**
 * Singleton mutable: mismo patrón que `SiteScopeBar`. El bundle del admin es
 * uno solo y pnpm hoistea el runtime a una única ubicación, así que la
 * variable es compartida entre host y plugins.
 */
let RegisteredComponent: ComponentType<ExtensionSettingsCardProps> | null = null;

export function registerExtensionSettingsCard(
  component: ComponentType<ExtensionSettingsCardProps> | null,
): void {
  RegisteredComponent = component;
}

/**
 * Los PLUGINS renderizan esto en sus pantallas de ajustes:
 *
 *     import { ExtensionSettingsCard } from '@minimalart/mercatto-plugin-runtime/admin';
 *     <ExtensionSettingsCard namespace="extension:gift-cards" />
 *
 * Fallback silencioso: sin registro, la card no se pinta. La página sigue
 * funcional; sólo falta ese bloque hasta que el host cargue.
 */
export function ExtensionSettingsCard(
  props: ExtensionSettingsCardProps,
): ReactElement | null {
  const Component = RegisteredComponent;
  if (!Component) return null;
  return <Component {...props} />;
}
