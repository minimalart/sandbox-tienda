export const DEFAULT_ADDRESS_NAME = "Casa";

export type AddressNamePreset = "Casa" | "Trabajo" | "Otro";

/**
 * Mantiene seleccionado el preset que representa al valor actual del campo.
 * Todo nombre que no sea uno de los presets conocidos pertenece a `Otro`.
 */
export function getAddressNamePreset(value: string): AddressNamePreset {
  if (value === "Casa" || value === "Trabajo") {
    return value;
  }

  return "Otro";
}

/**
 * Espeja `address_name` dentro de `metadata.address_name`.
 *
 * El nombre que el comprador le pone a la dirección ("Casa", "Trabajo", el que
 * escriba) no sobrevive el ida y vuelta por el campo nativo, así que todo el
 * storefront lo lee de los DOS lados: `extractAddressName()` mira primero
 * `address_name` y después `metadata.address_name`, y `toCartAddressPayload()`
 * lo escribe en metadata.
 *
 * El único camino que no lo espejaba era la CREACIÓN: `add-address.tsx` arma un
 * `metadata` con lat/lng y se olvida del nombre, y el alta desde el checkout lo
 * manda pelado. El update, en cambio, sí lo espeja. Resultado: la dirección
 * nacía sin nombre y no había forma de recuperarlo — reportado en QA
 * (DESDEELSUR-33, "Datos de envío - no guarda el nombre personalizado").
 *
 * Se normaliza en `/api/store/addresses`, el único punto por el que pasan las
 * dos puertas de alta, en vez de en cada componente.
 */
export function withMirroredAddressName<T>(address: T): T {
  if (!address || typeof address !== "object") return address;
  const addr = address as {
    address_name?: unknown;
    metadata?: Record<string, unknown> | null;
  };
  const name = addr.address_name;
  if (typeof name !== "string" || name.length === 0) return address;
  return {
    ...addr,
    metadata: { ...(addr.metadata ?? {}), address_name: name },
  } as T;
}
