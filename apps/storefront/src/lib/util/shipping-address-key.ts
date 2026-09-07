// Campos mínimos que nos importan de shipping_address: no importamos
// HttpTypes acá para que esta función siga siendo un módulo puro, chico y
// fácil de testear con `node --test` (mismo criterio que shipping-gate.ts
// en el backend).
type MinimalShippingAddress = {
  address_1?: string | null;
  address_2?: string | null;
  city?: string | null;
  province?: string | null;
  postal_code?: string | null;
  country_code?: string | null;
  metadata?: Record<string, unknown> | null;
};

/**
 * Serializa los campos de `cart.shipping_address` que pueden mover el
 * resultado del gate de cobertura o el cálculo de tarifas, para usar como
 * dependencia ESTABLE de un efecto de refetch.
 *
 * Por qué no usar el objeto `shipping_address` directo como dependencia: el
 * cart llega como un objeto NUEVO en cada render (viene de setCart en el
 * padre), así que su identidad cambia aunque el contenido sea el mismo — eso
 * dispararía el efecto en cada render y no solo cuando la dirección cambia de
 * verdad.
 *
 * Sin dirección (cart recién creado, todavía en el paso de datos personales)
 * la clave es el centinela `""`, nunca `undefined`: un efecto que dependa de
 * esta clave debe dispararse UNA vez con `""` y quedarse quieto hasta que
 * cambie, no reevaluar en cada render porque la dependencia es "inestable".
 *
 * El orden de prioridad lat/lng (`lat ?? latitude`, `lng ?? longitude`)
 * espeja a propósito el de `extractLatLng` en el backend
 * (apps/backend/src/modules/delivery/geo.ts): si las dos capas leyeran
 * coordenadas distintas, el checkout podría mostrar cobertura para un punto y
 * calcular el envío contra otro.
 */
export function buildShippingAddressKey(
  address: MinimalShippingAddress | null | undefined,
): string {
  if (!address) return "";

  const metadata = address.metadata ?? {};
  const lat = metadata.lat ?? metadata.latitude;
  const lng = metadata.lng ?? metadata.longitude;

  return [
    address.address_1 ?? "",
    address.address_2 ?? "",
    address.city ?? "",
    address.province ?? "",
    address.postal_code ?? "",
    address.country_code ?? "",
    lat === undefined || lat === null ? "" : String(lat),
    lng === undefined || lng === null ? "" : String(lng),
  ].join("|");
}

export default buildShippingAddressKey;
