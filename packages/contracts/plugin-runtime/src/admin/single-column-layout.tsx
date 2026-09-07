import type { ComponentType, ReactElement, ReactNode } from 'react';

/**
 * Slot para el shell de una columna que apila las cards de las pantallas de
 * ajustes con la separación canónica del admin (ver el componente concreto en
 * `apps/backend/src/admin/components/layouts/single-column.tsx`).
 *
 * A diferencia de los otros slots, este NO puede caer a `null` cuando el host
 * no está registrado: si desapareciera, TODO el contenido de la página se
 * dejaría de renderizar. Por eso el fallback es un fragmento pass-through —
 * la página pierde la separación canónica por 1 render pero sigue visible.
 */
export type SingleColumnLayoutProps = {
  children: ReactNode;
};

/**
 * Singleton mutable: mismo patrón que `SiteScopeBar`.
 */
let RegisteredComponent: ComponentType<SingleColumnLayoutProps> | null = null;

export function registerSingleColumnLayout(
  component: ComponentType<SingleColumnLayoutProps> | null,
): void {
  RegisteredComponent = component;
}

/**
 * Los PLUGINS envuelven así las pantallas de ajustes con varias cards:
 *
 *     import { SingleColumnLayout } from '@minimalart/mercatto-plugin-runtime/admin';
 *     <SingleColumnLayout>
 *       <FirstCard />
 *       <SecondCard />
 *     </SingleColumnLayout>
 *
 * Fallback NO nulo: si el host todavía no registró, se devuelve `<>{children}</>`
 * para que el contenido siga visible. Perder el wrapper de layout es menos malo
 * que perder toda la página.
 */
export function SingleColumnLayout({ children }: SingleColumnLayoutProps): ReactElement {
  const Component = RegisteredComponent;
  if (!Component) return <>{children}</>;
  return <Component>{children}</Component>;
}
