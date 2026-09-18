"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Sucursal propia disponible para retiro (store pickup). Espejo liviano del
 * patrón de use-carrier-branches, incluyendo la ruta: se consulta la API route
 * de Next (`/api/store/store-locations`), no el backend directo.
 *
 * Llamar al backend desde el browser lo ata a que `STORE_CORS` incluya el
 * dominio de la tienda, y eso se configura por entorno. En desdeelsur no estaba
 * seteada y el preflight volvía sin `access-control-allow-origin`: el paso de
 * "Retiro en tienda" no listaba una sola sucursal. Same-origin, ese modo de
 * falla no existe.
 */
export type StorePickupLocation = {
  id: string;
  name: string;
  address: string;
  city: string;
  province: string;
  latitude: number | null;
  longitude: number | null;
  /**
   * Stock location de la sucursal. Es la clave con la que el checkout elige la
   * shipping option de retiro QUE CORRESPONDE a esta sucursal, porque cada
   * fulfillment set cuelga de una stock location. `null` cuando la sucursal se
   * restauró de la metadata del carrito (ahí sólo viajan id y nombre) o cuando
   * todavía no se mapeó en el admin.
   */
  stock_location_id: string | null;
};

type RawStoreLocation = {
  id: string;
  name: string;
  street?: string | null;
  city?: string | null;
  province?: string | null;
  lat?: string | null;
  lng?: string | null;
  stock_location_id?: string | null;
  /**
   * Si la sucursal se ofrece como punto de retiro. Lo calcula la API route
   * (`app/api/store/store-locations/route.ts`) a partir del flag "Permite
   * retiro" del tipo que le puso la tienda: acá, del lado del cliente, no hay
   * acceso al tenant. Ausente = se muestra, para no esconder sucursales si la
   * route no lo pudo resolver.
   */
  pickup?: boolean;
};

const STORE_LOCATIONS_URL = "/api/store/store-locations";

const toNum = (v?: string | null): number | null => {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * Trae las sucursales para retiro en tienda. Excluye los tipos que la tienda
 * marcó como "no permite retiro" — antes era un `!== "distribution_center"`
 * clavado acá, que con tipos configurables por tienda dejaba pasar cualquier
 * tipo nuevo. Auto-fetch cuando `enabled` es true.
 */
export function useStorePickupLocations(enabled: boolean) {
  const [locations, setLocations] = useState<StorePickupLocation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLocations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(STORE_LOCATIONS_URL);
      if (!res.ok) {
        setError("No se pudieron cargar las sucursales.");
        setLocations([]);
        return;
      }
      const data = (await res.json()) as {
        store_locations?: RawStoreLocation[];
      };
      const mapped = (data.store_locations ?? [])
        .filter((l) => l.pickup !== false)
        .map((l) => ({
          id: l.id,
          name: l.name,
          address: l.street ?? "",
          city: l.city ?? "",
          province: l.province ?? "",
          latitude: toNum(l.lat),
          longitude: toNum(l.lng),
          stock_location_id: l.stock_location_id ?? null,
        }));
      setLocations(mapped);
    } catch {
      setError("No se pudieron cargar las sucursales.");
      setLocations([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) void fetchLocations();
  }, [enabled, fetchLocations]);

  return { locations, isLoading, error, fetchLocations };
}
