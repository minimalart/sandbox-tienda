import { getActiveTenant } from "@lib/site-config/active-tenant";
import { resolveBranchTypes } from "@lib/util/branch-types";
import { NextResponse } from "next/server";

/**
 * GET /api/store/store-locations — proxy de `GET {BACKEND}/store/store-locations`.
 *
 * ¿Por qué un proxy y no llamar al backend desde el browser?
 *
 * Porque una llamada directa del cliente al backend depende de que `STORE_CORS`
 * incluya el dominio del storefront, y ese es un dato de INFRAESTRUCTURA que se
 * configura por entorno y por tienda. En desdeelsur (2026-08-24) no estaba
 * seteada: el backend de producción corría con el default de `medusa-config.ts`
 * (`http://localhost:3000`), así que el preflight volvía 204 SIN
 * `access-control-allow-origin` y el paso de "Retiro en tienda" del checkout no
 * podía listar una sola sucursal. El síntoma en el browser era un error de CORS
 * sin ninguna relación aparente con el checkout.
 *
 * Yendo por acá el fetch es same-origin y el problema no puede volver: la
 * llamada al backend sale del servidor de Next, donde no hay CORS. Es además la
 * convención del resto del storefront — ver
 * `app/api/store/carrier-branches/route.ts`, que hace exactamente esto para las
 * sucursales de los carriers.
 *
 * Query params: se reenvían `sales_channel_id` y `strict` tal cual; el backend
 * los usa para acotar la lista a las sucursales visibles en un canal (ver
 * `apps/backend/src/api/store/store-locations/route.ts`).
 */

const BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000";
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "";

// Sólo estos: reenviar la query entera dejaría que el cliente inyecte params
// que el backend no espera.
const FORWARDED_PARAMS = ["sales_channel_id", "strict"] as const;

const branchTypesForTenant = async () => {
  const tenant = await getActiveTenant();
  return resolveBranchTypes(tenant.assets.sucursales);
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const upstream = new URL(`${BACKEND_URL}/store/store-locations`);

  for (const param of FORWARDED_PARAMS) {
    const value = url.searchParams.get(param);
    if (value) {
      upstream.searchParams.set(param, value);
    }
  }

  try {
    const response = await fetch(upstream.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(PUBLISHABLE_KEY ? { "x-publishable-api-key": PUBLISHABLE_KEY } : {}),
      },
      cache: "no-store",
    });

    if (!response.ok) {
      // El body crudo se loguea pero NUNCA se le devuelve al cliente: puede ser
      // una página HTML de error del gateway. Mismo criterio que
      // carrier-branches.
      const body = await response.text().catch(() => "");
      console.error(
        `[API] Store locations lookup failed (${response.status}): ${body}`,
      );
      return NextResponse.json(
        { message: "No se pudieron cargar las sucursales.", store_locations: [] },
        { status: 502 },
      );
    }

    const payload = (await response.json()) as {
      store_locations?: { store_type?: string | null }[];
    };

    /**
     * `pickup` se resuelve ACÁ y no en el consumidor.
     *
     * Quién puede ser punto de retiro dejó de ser una propiedad del código
     * (`store_type !== "distribution_center"`) y pasó a ser un flag por tipo
     * que configura cada tienda. Pero el consumidor —
     * `use-store-pickup-locations` — es un hook de cliente que no tiene forma
     * de ver el tenant. Esta route sí: corre en el servidor de Next, así que
     * resuelve los tipos de la tienda activa y anota cada sucursal.
     *
     * Si el tenant no se puede resolver, `resolveBranchTypes(undefined)`
     * devuelve los tres tipos históricos: el checkout sigue excluyendo los
     * centros de distribución, que es el comportamiento de siempre.
     */
    let types: Awaited<ReturnType<typeof branchTypesForTenant>> = [];
    try {
      types = await branchTypesForTenant();
    } catch (error) {
      console.error("[API] Failed to resolve branch types:", error);
      types = resolveBranchTypes(undefined);
    }
    const pickupById = new Map(types.map((type) => [type.id, type.pickup]));

    return NextResponse.json({
      ...payload,
      store_locations: (payload.store_locations ?? []).map((location) => ({
        ...location,
        // Sin tipo, la sucursal es un punto de retiro: es lo que corresponde en
        // una tienda que directamente no clasifica sus sucursales.
        pickup: location.store_type ? (pickupById.get(location.store_type) ?? true) : true,
      })),
    });
  } catch (error) {
    console.error("[API] Failed to fetch store locations:", error);
    return NextResponse.json(
      { message: "No se pudieron cargar las sucursales.", store_locations: [] },
      { status: 502 },
    );
  }
}
