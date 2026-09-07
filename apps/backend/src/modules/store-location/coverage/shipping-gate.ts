/**
 * Regla de COBERTURA aplicada al listado de envíos del checkout: qué opciones
 * sobreviven cuando la dirección del cliente cae FUERA de todos los polígonos de
 * sucursal.
 *
 * Vive en un módulo puro (sin nada de `@medusajs/framework` ni del container)
 * por la misma razón que `erp/fulfillment-coverage.ts`: es la regla de negocio, y
 * tiene que poder testearse con `node --test` sin levantar Medusa. El glue HTTP
 * que la usa está en `api/store/store-locations/shipping-coverage-gate.ts`.
 *
 * Por qué la regla existe: `GET /store/shipping-options` es NATIVO de Medusa y no
 * sabe nada de polígonos, así que devolvía "Envío Estándar" para cualquier
 * dirección. Esconderlo en el storefront no alcanza — la opción sigue siendo
 * seleccionable por API y termina en una orden que la flota no puede entregar.
 *
 * QUÉ SE FILTRA — sólo la flota propia A DOMICILIO, y es deliberadamente
 * conservador:
 *
 *  - Andreani y Correo Argentino NO se tocan: su cobertura es nacional y no
 *    depende de los polígonos de sucursal. Filtrarlos dejaría sin ninguna opción
 *    a un cliente del interior al que sí le podemos vender.
 *  - Nada con `data.pickup_kind` se toca NUNCA: el retiro (en tienda propia o en
 *    sucursal de carrier) no entrega en la dirección del cliente, así que su
 *    cobertura es irrelevante. Es la salida que le queda a quien está fuera del
 *    polígono.
 */

/**
 * `delivery/geo.ts` es otro módulo PURO (cero imports propios), así que traerlo
 * no rompe el `node --test` de este archivo.
 *
 * OJO — ACOPLAMIENTO ENTRE EXTENSIONES, a sabiendas: la extensión `delivery`
 * declara `store-locations` como dependencia, así que este import va CONTRA la
 * dirección declarada. Un sitio compuesto con `store-locations` y SIN `delivery`
 * quedaría importando un módulo que nunca se instaló.
 *
 * Se acepta porque el repo ya convive con el mismo patrón en la otra punta
 * (`delivery/normalizers/correo-argentino.ts` importa de
 * `correo-argentino-fulfillment` mientras la dependencia está declarada al
 * revés), y porque duplicar el parseo es peor: garantizaría que el checkout y
 * `create-delivery-execution` resuelvan puntos distintos.
 *
 * La salida limpia —extraer un primitivo `geo` compartido a un paquete neutro—
 * es un refactor de dos extensiones y queda fuera del alcance de DESDEELSUR-19.
 */
import { extractLatLng } from '../../delivery/geo';

/**
 * `provider_id` de la flota propia. Es el provider `manual` de Medusa, que se
 * siembra con este id compuesto (`seed-operational.ts`). No hay un provider
 * dedicado: lo que distingue a la flota propia del resto es justamente esto.
 */
export const OWN_FLEET_PROVIDER_ID = 'manual_manual';

/**
 * Lo MÍNIMO que el gate necesita de una shipping option. A propósito no se usa
 * `HttpTypes.StoreCartShippingOption`: ese tipo arrastra `@medusajs/types`, y
 * este archivo tiene que seguir siendo importable desde `node --test`.
 */
export type CoverageShippingOption = {
  id?: unknown;
  provider_id?: unknown;
  data?: Record<string, unknown> | null;
};

/** Una dirección de la que sólo nos importa su `metadata`. */
export type CoverageAddress = {
  metadata?: Record<string, unknown> | null;
} | null | undefined;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * ¿Es una opción de flota propia A DOMICILIO? — la única familia que el gate
 * puede descartar.
 *
 * La ausencia de `pickup_kind` se chequea contra `null`/`undefined`/string vacío
 * y no con un `in`: una option creada a mano desde el Admin puede traer `data`
 * con la clave presente y vacía, y esa sigue siendo una entrega a domicilio.
 */
export function isOwnFleetHomeOption(option: CoverageShippingOption): boolean {
  if (option?.provider_id !== OWN_FLEET_PROVIDER_ID) return false;
  const pickupKind = isRecord(option.data) ? option.data.pickup_kind : undefined;
  if (pickupKind === null || pickupKind === undefined) return true;
  return typeof pickupKind === 'string' && pickupKind.trim() === '';
}

/**
 * Las opciones que se le muestran al cliente.
 *
 * `covered === true` devuelve el array TAL CUAL (misma referencia): cuando hay
 * cobertura el gate no tiene nada que decir, y no queremos que un bug de copia
 * altere el orden o el shape de la respuesta nativa.
 */
export function filterOptionsByCoverage<T extends CoverageShippingOption>(
  options: T[],
  covered: boolean
): T[] {
  if (covered) return options;
  return options.filter((option) => !isOwnFleetHomeOption(option));
}

/**
 * Coordenadas de la dirección del cliente, en el formato `string` que espera
 * `resolveByPoint` (`GeoPoint`).
 *
 * Delega en `extractLatLng` en vez de re-parsear el metadata: esa función ya es
 * la fuente de verdad del repo para esto —acepta las DOS convenciones de claves
 * que escribe el storefront (`lat`/`lng` y `latitude`/`longitude`), normaliza
 * string|number y valida rango geográfico—, y duplicarla acá garantizaría que
 * las dos capas se desincronicen. El síntoma sería el peor posible: el checkout
 * mostrando cobertura distinta de la que después resuelve el envío.
 */
export function extractCoordinates(address: CoverageAddress): { lat: string; lng: string } | null {
  const coords = extractLatLng(address?.metadata);
  if (!coords) return null;
  return { lat: String(coords.lat), lng: String(coords.lng) };
}
