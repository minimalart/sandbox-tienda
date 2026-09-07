import type { SettingDescriptor } from '../../../modules/app-settings/descriptors';
import { CardSiteContext } from '../common/card-site-context';

/**
 * Contexto de tienda de una card de `ExtensionSettingsCard`, derivado del DATO.
 *
 * Todo el render vive en `<CardSiteContext />` (`components/common/card-site-context.tsx`).
 * Lo único propio de acá es cómo se contesta "¿este ajuste es por tienda?": la respuesta
 * ya está en el descriptor, que declara `scope: 'site' | 'instance'`
 * (`descriptors/types.ts:98`). Leerla del descriptor en vez de un registro paralelo
 * significa que una extensión nueva queda bien contada el día que se escribe, sin que
 * nadie se acuerde de registrarla. Un registro que hay que mantener a mano para 29
 * namespaces es un registro que va a estar desactualizado — es exactamente la deuda
 * que arrastra `lib/site-scope.ts` para las pantallas de lista.
 *
 * POR QUÉ ESTA DERIVACIÓN NO SE MUDÓ AL COMPONENTE COMÚN: los otros consumidores —los
 * formularios escritos a mano y las cards de `store-config/`— no tienen descriptores.
 * Su scope lo define la ruta que consumen, así que lo declaran por prop. Meter
 * `descriptors` en la API común obligaría a esos a fabricar descriptores falsos sólo
 * para pedir la franja.
 *
 * POR QUÉ VA EN LA CARD Y NO EN CADA PÁGINA: la card es la que mete `activeId` en la
 * query key y en el header `x-site-id` (`hooks/api/app-settings.tsx:105`). El
 * componente que hace el scoping es el que tiene que declararlo. Montarlo en las ~28
 * páginas consumidoras a mano es la misma deuda que `SiteScopeBar` ya arrastra:
 * la página 29 nace sin barra y nadie se entera.
 */

type Props = {
  /** Los descriptores que ESTA card muestra, ya filtrados por `groups`/`only`. */
  descriptors: SettingDescriptor[];
  /**
   * Hay cambios sin guardar. Cambiar de tienda recarga la página y se los lleva
   * puestos, así que con esto en `true` se pide confirmación antes.
   */
  dirty: boolean;
};

export const SettingsSiteContext = ({ descriptors, dirty }: Props) => {
  // Card vacía: no hay ajuste del que hablar, así que tampoco hay contexto que dar.
  // Se corta acá y no adentro de `<CardSiteContext />` porque ese componente no ve
  // descriptores; además así ni se suscribe al manifest de tiendas.
  if (descriptors.length === 0) return null;

  // Basta UNO por tienda para que la card entera necesite selector: mostrar "instancia"
  // en una card donde una sola fila se resuelve por tienda haría que esa fila apareciera
  // apagada sin explicación.
  const scope = descriptors.some((d) => d.scope === 'site') ? 'site' : 'instance';

  return <CardSiteContext scope={scope} dirty={dirty} />;
};
