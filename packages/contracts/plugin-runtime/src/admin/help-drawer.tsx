import type { ComponentType, ReactElement } from 'react';

/**
 * Slot para el botón + drawer de ayuda del header de una página.
 *
 * El componente concreto vive en el host (`apps/backend/src/admin/components/
 * common/help-drawer.tsx`) porque lee el registro central `helpFor(slug)` con
 * el contenido en markdown de cada extensión. Los plugins publicados renderizan
 * este slot con su slug y el host resuelve el contenido.
 *
 * `slug` coincide con el directorio en `routes/` y con la clave en
 * `help/index.ts` del host — mismo acuerdo de nombres del componente real.
 */
export type HelpDrawerProps = {
  slug: string;
};

/**
 * Singleton mutable: mismo patrón que `SiteScopeBar`.
 */
let RegisteredComponent: ComponentType<HelpDrawerProps> | null = null;

export function registerHelpDrawer(
  component: ComponentType<HelpDrawerProps> | null,
): void {
  RegisteredComponent = component;
}

/**
 * Los PLUGINS renderizan esto en el header de sus pantallas:
 *
 *     import { HelpDrawer } from '@minimalart/mercatto-plugin-runtime/admin';
 *     <HelpDrawer slug="gift-cards" />
 *
 * Fallback silencioso: sin registro, no se pinta nada. El propio componente
 * host además devuelve `null` cuando el slug no tiene ayuda escrita todavía.
 */
export function HelpDrawer(props: HelpDrawerProps): ReactElement | null {
  const Component = RegisteredComponent;
  if (!Component) return null;
  return <Component {...props} />;
}
