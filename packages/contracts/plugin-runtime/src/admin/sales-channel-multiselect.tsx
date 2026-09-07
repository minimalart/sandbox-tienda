import type { ComponentType, ReactElement } from 'react';

/**
 * Slot para el multi-select de sales channels (checkbox list) reutilizado por
 * banners, brands, blog y otras extensiones que segmentan contenido por canal.
 *
 * El componente concreto vive en el host (`apps/backend/src/admin/components/
 * sales-channel-multiselect.tsx`) porque depende del SDK de Medusa
 * (`sdk.admin.salesChannel.list`) para traer la lista de canales. Los plugins
 * publicados no pueden importar el cliente del host — su bundle carga en el
 * mismo admin, pero el módulo `../lib/client` es específico de cada plugin —
 * y duplicar la fetch en cada plugin desperdicia bundle y desincroniza las
 * queries de React Query (cada plugin tendría su propio `queryKey`, y los
 * canales aparecerían y desaparecerían entre re-renders).
 *
 * Centralizando el slot, la fetch es una sola por sesión y todas las UI
 * comparten el mismo cache.
 *
 * `value` son los ids seleccionados; `onChange` recibe el array completo tras
 * cada toggle. Empty array = "todos los canales" (política del host — el slot
 * no la interpreta, solo la delega).
 */
export type SalesChannelMultiSelectProps = {
  value: string[];
  onChange: (ids: string[]) => void;
  label?: string;
  help?: string;
};

/**
 * Singleton mutable: mismo patrón que `SiteScopeBar`. El bundle del admin es
 * uno solo y pnpm hoistea el runtime a una única ubicación, así que la
 * variable es compartida entre host y plugins.
 */
let RegisteredComponent: ComponentType<SalesChannelMultiSelectProps> | null = null;

/**
 * El HOST llama esto al final del archivo donde exporta la implementación:
 *
 *     export const SalesChannelMultiSelect = (...) => { ... };
 *     registerSalesChannelMultiSelect(SalesChannelMultiSelect);
 */
export function registerSalesChannelMultiSelect(
  component: ComponentType<SalesChannelMultiSelectProps> | null,
): void {
  RegisteredComponent = component;
}

/**
 * Los PLUGINS renderizan esto en sus forms de segmentación:
 *
 *     import { SalesChannelMultiSelect } from '@minimalart/mercatto-plugin-runtime/admin';
 *     <SalesChannelMultiSelect value={ids} onChange={setIds} label="Canales" />
 *
 * Fallback silencioso: si el host todavía no registró, no se renderiza nada.
 * El operador pierde el widget por 1 render pero el resto del form sigue vivo,
 * y en la práctica el import del host se dispara junto con la carga del bundle.
 */
export function SalesChannelMultiSelect(
  props: SalesChannelMultiSelectProps,
): ReactElement | null {
  const Component = RegisteredComponent;
  if (!Component) return null;
  return <Component {...props} />;
}
