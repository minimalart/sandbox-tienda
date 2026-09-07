import type { ComponentType, ReactElement } from 'react';

/**
 * Props que reproducen la firma de la barra concreta que vive en el host.
 * Cualquier cambio de firma acá es breaking para los plugins que la consumen
 * y para el registrador del host — por eso está tipada acá y no en el host.
 *
 * `screen` es un slug arbitrario (`'comments'`, `'pdf-catalogs'`, etc.) que
 * el host mapea a `SiteScopeState` internamente para decidir qué badge de
 * "cómo se comporta esta pantalla con la tienda" mostrar. Los plugins no
 * necesitan entender esa tabla — solo pasar su slug estable.
 */
export type SiteScopeBarProps = {
  screen: string;
  reloadOnChange?: boolean;
  allowInstance?: boolean;
  variant?: 'bar' | 'card';
};

/**
 * Referencia mutable al componente concreto que el host registra al arrancar.
 *
 * ─── POR QUÉ FUNCIONA COMO SINGLETON EN EL BUNDLE DEL ADMIN ─────────────────
 *
 * El bundle del admin de Medusa es UN solo bundle: las admin extensions del
 * host y de todos los plugins publicados terminan concatenadas por Vite en el
 * mismo asset del navegador. Como pnpm hoistea `@minimalart/mercatto-plugin-runtime`
 * a UNA sola ubicación en `node_modules`, todos los imports resuelven al MISMO
 * módulo — el `RegisteredComponent` es una variable compartida a nivel proceso
 * del navegador. Cuando el host la escribe, todos los plugins la ven.
 *
 * ─── QUÉ PASA EN LOS EDGE CASES ────────────────────────────────────────────
 *
 * Antes del primer registrado (bundle recién cargado, ninguna ruta host todavía
 * ejecutada), el slot renderiza `null`. En la práctica el registrador vive al
 * final de `apps/backend/src/admin/components/common/site-scope-bar.tsx`, que
 * las páginas del host ya importaban en 41 archivos: cualquier página que se
 * cargue —del host o del plugin— antes o durante la renderización del slot ya
 * dispara la registración por el side effect del import.
 */
let RegisteredComponent: ComponentType<SiteScopeBarProps> | null = null;

/**
 * El HOST llama esto UNA vez, al final del archivo donde exporta su
 * implementación concreta:
 *
 *     export const SiteScopeBar = (...) => { ... };
 *     registerSiteScopeBar(SiteScopeBar);
 *
 * Pasar `null` desconecta (útil en tests unitarios del contract).
 */
export function registerSiteScopeBar(
  component: ComponentType<SiteScopeBarProps> | null,
): void {
  RegisteredComponent = component;
}

/**
 * Los PLUGINS renderizan esto en sus admin routes:
 *
 *     import { SiteScopeBar } from '@minimalart/mercatto-plugin-runtime/admin';
 *     <SiteScopeBar screen="pdf-catalogs" />
 *
 * Si el host todavía no registró (fallback silencioso), el slot no renderiza
 * nada — la página sigue funcional, solo falta la barra por 1 render, y en la
 * práctica el import del host se dispara junto con la carga del bundle.
 */
export function SiteScopeBar(props: SiteScopeBarProps): ReactElement | null {
  const Component = RegisteredComponent;
  if (!Component) return null;
  return <Component {...props} />;
}
