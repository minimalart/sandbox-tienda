import { NextResponse } from "next/server";

// ============================================================================
// TIPOS
// ============================================================================

export interface CarrierBranch {
  id: string;
  code?: string;
  description: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;
  phone: string;
  type: string;
  network: string;
  latitude?: number;
  longitude?: number;
  businessHours?: string;
}

type BackendAndreaniAddress = {
  street?: string | null;
  number?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  province?: string | null;
  postal_code?: string | null;
};

type BackendAndreaniCoordinates = {
  latitude?: number | null;
  longitude?: number | null;
};

type BackendAndreaniContactInfo = {
  phone?: string | null;
};

type BackendAndreaniOperatingHours = {
  day?: string | null;
  open_time?: string | null;
  close_time?: string | null;
  is_closed?: boolean | null;
};

type BackendAndreaniBranch = {
  id?: string | number | null;
  code?: string | number | null;
  number?: string | number | null;
  name?: string | null;
  description?: string | null;
  service_type?: string | null;
  address?: BackendAndreaniAddress | null;
  coordinates?: BackendAndreaniCoordinates | null;
  contact_info?: BackendAndreaniContactInfo | null;
  operating_hours?: BackendAndreaniOperatingHours[] | null;
};

type BackendAndreaniBranchesResponse = {
  branches?: BackendAndreaniBranch[] | null;
};

// ============================================================================
// CONFIG
// ============================================================================

const BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000";
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "";

// Service types de Andreani. Cada carrier define los suyos — este mapa vive
// también (por ahora, hasta que haya un segundo carrier) en
// use-carrier-branches.ts para la validación del lado del hook.
type AndreaniServiceType = "Sucursal" | "PuntoDeTercero";

function isAndreaniServiceType(
  value: string | null,
): value is AndreaniServiceType {
  return value === "Sucursal" || value === "PuntoDeTercero";
}

// ============================================================================
// POSTAL CODE NORMALIZATION (compartido entre carriers)
// ============================================================================

/**
 * Normalizes an Argentine postal code to the 4-digit numeric format expected
 * upstream.
 *
 * Examples:
 *   "C1025AAO" → "1025"  (full CPA)
 *   "C1025"    → "1025"  (truncated CPA)
 *   "1025"     → "1025"  (already numeric)
 *   "B1636"    → "1636"
 */
function normalizePostalCode(raw: string): string {
  const trimmed = raw.trim();

  // CPA format: optional letter + 4 digits + optional 3 letters
  const cpaMatch = trimmed.match(/^[A-Za-z]?(\d{4})[A-Za-z]{0,3}$/);
  if (cpaMatch) {
    return cpaMatch[1];
  }

  // Already numeric
  if (/^\d{4,5}$/.test(trimmed)) {
    return trimmed;
  }

  // Fallback: strip non-digits
  const digits = trimmed.replace(/\D/g, "");
  return digits.length >= 4 ? digits.slice(0, 4) : trimmed;
}

// ============================================================================
// ERRORS (compartido entre carriers)
// ============================================================================

/**
 * User-facing error for a failed branch lookup. Carries a clean message only —
 * the raw upstream body is logged separately, never exposed to the client.
 */
class CarrierLookupError extends Error {
  constructor(public readonly status: number) {
    super(messageForStatus(status));
    this.name = "CarrierLookupError";
  }
}

function messageForStatus(status: number): string {
  if (status === 429) {
    return "Demasiadas consultas al servicio de sucursales. Esperá unos segundos e intentá de nuevo.";
  }

  if (status >= 500) {
    return "El servicio de sucursales no está disponible en este momento. Intentá de nuevo en unos minutos.";
  }

  return "No pudimos buscar las sucursales. Intentá de nuevo en unos minutos.";
}

function normalizeString(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number") {
    return String(value).trim();
  }

  return "";
}

function formatOperatingHours(
  operatingHours?: BackendAndreaniOperatingHours[] | null,
): string {
  if (!operatingHours?.length) {
    return "";
  }

  const dayLabels: Record<string, string> = {
    monday: "Lun",
    tuesday: "Mar",
    wednesday: "Mié",
    thursday: "Jue",
    friday: "Vie",
    saturday: "Sáb",
    sunday: "Dom",
  };

  return operatingHours
    .map((slot) => {
      if (slot.is_closed) {
        return "";
      }

      const normalizedDay = normalizeString(slot.day);
      const day = normalizedDay
        ? dayLabels[normalizedDay.toLowerCase()] || normalizedDay
        : "";
      const openTime = normalizeString(slot.open_time);
      const closeTime = normalizeString(slot.close_time);

      if (!day && !openTime && !closeTime) {
        return "";
      }

      if (!openTime || !closeTime) {
        return day;
      }

      return `${day} ${openTime}-${closeTime}`.trim();
    })
    .filter((value) => value.length > 0)
    .join(" · ");
}

// ============================================================================
// ADAPTER: ANDREANI
// ============================================================================

async function fetchAndreaniBranches(
  postalCode: string,
  serviceType: AndreaniServiceType | undefined,
): Promise<BackendAndreaniBranchesResponse> {
  // Public store route — credentials live in the backend Andreani provider (env).
  const upstream = new URL(`${BACKEND_URL}/store/andreani/branches`);
  upstream.searchParams.set("postal_code", postalCode);
  if (serviceType) {
    upstream.searchParams.set("service_type", serviceType);
  }

  const response = await fetch(upstream.toString(), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...(PUBLISHABLE_KEY ? { "x-publishable-api-key": PUBLISHABLE_KEY } : {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    // Log the raw upstream body for debugging, but NEVER surface it to the
    // user — it can be an HTML error page from the platform gateway.
    const body = await response.text().catch(() => "");
    console.error(
      `[API] Andreani branch lookup failed (${response.status}): ${body}`,
    );
    throw new CarrierLookupError(response.status);
  }

  return (await response.json()) as BackendAndreaniBranchesResponse;
}

function buildAndreaniBranchId(branch: BackendAndreaniBranch): string {
  const idValue = branch.number ?? branch.id ?? branch.code;

  if (idValue !== null && idValue !== undefined && String(idValue).trim()) {
    return String(idValue);
  }

  const fallback = [
    normalizeString(branch.name),
    normalizeString(branch.description),
    normalizeString(branch.address?.postal_code),
  ]
    .filter((value): value is string => Boolean(value))
    .join("-")
    .toLowerCase()
    .replace(/\s+/g, "-");

  return fallback || "andreani-branch";
}

function buildAndreaniAddress(address?: BackendAndreaniAddress | null): string {
  if (!address) {
    return "";
  }

  const streetLine = [normalizeString(address.street), normalizeString(address.number)]
    .filter((value): value is string => Boolean(value))
    .join(" ");

  return [streetLine, normalizeString(address.neighborhood)]
    .filter((value): value is string => Boolean(value))
    .join(", ");
}

function mapAndreaniBranches(
  data: BackendAndreaniBranchesResponse,
  postalCode: string,
  sourceServiceType: AndreaniServiceType,
): CarrierBranch[] {
  return (data.branches || []).map((branch) => {
    const description =
      normalizeString(branch.description) ||
      normalizeString(branch.name) ||
      buildAndreaniBranchId(branch);
    // The backend transformer only returns `description` (no `name`/`service_type`),
    // so la red se resuelve por el endpoint de origen (PuntoDeTercero = hop)
    // más el texto de description/service_type como fallback.
    const network =
      sourceServiceType === "PuntoDeTercero" ||
      normalizeString(branch.service_type) === "PuntoDeTercero" ||
      description.toLowerCase().includes("hop")
        ? "hop"
        : "sucursal";
    return {
      id: buildAndreaniBranchId(branch),
      description,
      address: buildAndreaniAddress(branch.address),
      city: normalizeString(branch.address?.city),
      province: normalizeString(branch.address?.province),
      postalCode: normalizeString(branch.address?.postal_code) || postalCode,
      phone: normalizeString(branch.contact_info?.phone),
      type: normalizeString(branch.service_type) || sourceServiceType,
      network,
      latitude: branch.coordinates?.latitude ?? undefined,
      longitude: branch.coordinates?.longitude ?? undefined,
      businessHours: formatOperatingHours(branch.operating_hours),
    };
  });
}

async function searchAndreaniBranches(
  postalCode: string,
  serviceTypeParam: string | null,
): Promise<CarrierBranch[]> {
  // service_type ya fue validado contra CARRIER_SERVICE_TYPE_VALIDATORS en el
  // route handler antes de llegar acá; el narrow es solo para TS.
  if (serviceTypeParam && isAndreaniServiceType(serviceTypeParam)) {
    // Explicit single-type lookup (backward compatible).
    const backendResponse = await fetchAndreaniBranches(
      postalCode,
      serviceTypeParam,
    );
    return mapAndreaniBranches(backendResponse, postalCode, serviceTypeParam);
  }

  // Merged "Retiro en sucursales": Andreani branches (Sucursal) + HOP points
  // (PuntoDeTercero). Fetch both in parallel; if one endpoint fails we still
  // return whatever the other yielded.
  const [sucursales, hop] = await Promise.allSettled([
    fetchAndreaniBranches(postalCode, "Sucursal"),
    fetchAndreaniBranches(postalCode, "PuntoDeTercero"),
  ]);

  const merged: CarrierBranch[] = [];
  if (sucursales.status === "fulfilled") {
    merged.push(...mapAndreaniBranches(sucursales.value, postalCode, "Sucursal"));
  }
  if (hop.status === "fulfilled") {
    merged.push(...mapAndreaniBranches(hop.value, postalCode, "PuntoDeTercero"));
  }

  // If BOTH failed, surface the error like the single-type path does.
  if (sucursales.status === "rejected" && hop.status === "rejected") {
    throw sucursales.reason;
  }

  // Dedupe by id (the two networks shouldn't overlap, but be safe).
  const seen = new Set<string>();
  return merged.filter((b) => {
    if (seen.has(b.id)) return false;
    seen.add(b.id);
    return true;
  });
}

// ============================================================================
// ADAPTER: CORREO ARGENTINO
// ============================================================================
// El transformer del backend (`correo-argentino-fulfillment/transformers/
// agencies.ts`) ya emite el shape que este adapter espera —
// { id, code, name, description, service_type, address, coordinates,
// contact_info, operating_hours } — deliberadamente igual al de Andreani, así
// que no hace falta mapeo extra más allá de lo que ya hacíamos para Andreani.

type BackendCorreoAddress = {
  street?: string | null;
  number?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  province?: string | null;
  province_code?: string | null;
  postal_code?: string | null;
  country?: string | null;
};

type BackendCorreoCoordinates = {
  latitude?: number | null;
  longitude?: number | null;
} | null;

type BackendCorreoContactInfo = {
  phone?: string | null;
  email?: string | null;
  owner?: string | null;
};

type BackendCorreoOperatingHours = {
  day?: string | null;
  open_time?: string | null;
  close_time?: string | null;
  is_closed?: boolean | null;
};

type BackendCorreoAgency = {
  id?: string | null;
  code?: string | null;
  name?: string | null;
  description?: string | null;
  service_type?: string | null;
  address?: BackendCorreoAddress | null;
  coordinates?: BackendCorreoCoordinates;
  contact_info?: BackendCorreoContactInfo | null;
  operating_hours?: BackendCorreoOperatingHours[] | null;
};

type BackendCorreoAgenciesResponse = {
  agencies?: BackendCorreoAgency[] | null;
};

async function fetchCorreoBranches(
  postalCode: string,
): Promise<BackendCorreoAgenciesResponse> {
  // Public store route — credentials live in the backend Correo Argentino
  // provider (env). `postal_code` solo alcanza: la ruta del backend acepta
  // `state_id` o `postal_code`, y el filtro por CP se aplica en memoria ahí.
  const upstream = new URL(`${BACKEND_URL}/store/correo-argentino/agencies`);
  upstream.searchParams.set("postal_code", postalCode);

  const response = await fetch(upstream.toString(), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...(PUBLISHABLE_KEY ? { "x-publishable-api-key": PUBLISHABLE_KEY } : {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    // Log the raw upstream body for debugging, but NEVER surface it to the
    // user — it can be an HTML error page from the platform gateway.
    const body = await response.text().catch(() => "");
    console.error(
      `[API] Correo Argentino branch lookup failed (${response.status}): ${body}`,
    );
    throw new CarrierLookupError(response.status);
  }

  return (await response.json()) as BackendCorreoAgenciesResponse;
}

function buildCorreoAddress(address?: BackendCorreoAddress | null): string {
  if (!address) {
    return "";
  }

  const streetLine = [normalizeString(address.street), normalizeString(address.number)]
    .filter((value): value is string => Boolean(value))
    .join(" ");

  return [streetLine, normalizeString(address.neighborhood)]
    .filter((value): value is string => Boolean(value))
    .join(", ");
}

function mapCorreoBranches(
  data: BackendCorreoAgenciesResponse,
  postalCode: string,
): CarrierBranch[] {
  return (data.agencies || []).map((agency) => {
    const description =
      normalizeString(agency.description) ||
      normalizeString(agency.name) ||
      normalizeString(agency.id) ||
      "correo-branch";
    const id = normalizeString(agency.id) || normalizeString(agency.code);
    return {
      id: id || description.toLowerCase().replace(/\s+/g, "-"),
      code: normalizeString(agency.code) || undefined,
      description,
      address: buildCorreoAddress(agency.address),
      city: normalizeString(agency.address?.city),
      province: normalizeString(agency.address?.province),
      postalCode: normalizeString(agency.address?.postal_code) || postalCode,
      phone: normalizeString(agency.contact_info?.phone),
      type: normalizeString(agency.service_type) || "agency",
      // Correo tiene una sola red de retiro (a diferencia de Andreani:
      // Sucursal + HOP). Este valor no matchea ninguna key de
      // `CARRIER_REGISTRY.correo_argentino.networkBadges` (no define
      // ninguna), así que `ShippingProviderBadge` cae al logo principal del
      // carrier — el comportamiento correcto para un carrier de una red.
      network: "sucursal",
      latitude: agency.coordinates?.latitude ?? undefined,
      longitude: agency.coordinates?.longitude ?? undefined,
      businessHours: formatOperatingHours(agency.operating_hours),
    };
  });
}

async function searchCorreoBranches(
  postalCode: string,
  _serviceType: string | null,
): Promise<CarrierBranch[]> {
  // Correo no tiene el concepto de dos redes de retiro — a diferencia de
  // searchAndreaniBranches acá alcanza una sola llamada, sin el merge dual
  // con Promise.allSettled.
  const backendResponse = await fetchCorreoBranches(postalCode);
  return mapCorreoBranches(backendResponse, postalCode);
}

// ============================================================================
// CARRIER DISPATCH
// ============================================================================
// Un carrier nuevo se suma agregando su searcher acá — el resto de la ruta
// (validación de postal_code, sanitización de errores, shape de respuesta) es
// compartido.

type CarrierBranchSearcher = (
  postalCode: string,
  serviceType: string | null,
) => Promise<CarrierBranch[]>;

const CARRIER_BRANCH_SEARCHERS: Record<string, CarrierBranchSearcher> = {
  andreani: searchAndreaniBranches,
  correo_argentino: searchCorreoBranches,
};

// Validador de `service_type` por carrier — cada carrier tiene su propio
// vocabulario (Andreani: Sucursal/PuntoDeTercero). Ausente = el carrier no
// restringe el valor.
const CARRIER_SERVICE_TYPE_VALIDATORS: Record<string, (value: string) => boolean> = {
  andreani: isAndreaniServiceType,
  // Correo tiene una sola red de sucursales — no hay vocabulario de
  // service_type que validar como en Andreani (Sucursal/PuntoDeTercero).
  // Entrada explícita en vez de omitida para dejar registrado que se evaluó
  // este carrier acá, no un olvido.
  correo_argentino: () => true,
};

const CARRIER_SERVICE_TYPE_ERROR: Record<string, string> = {
  andreani: "service_type must be Sucursal or PuntoDeTercero",
};

// ============================================================================
// ROUTE HANDLER
// ============================================================================

function getErrorMessage(error: unknown): string {
  // Only our own typed error carries a vetted, user-safe message. Anything
  // else is treated as unexpected and gets a generic message so we never leak
  // raw upstream payloads or stack traces to the client.
  if (error instanceof CarrierLookupError) {
    return error.message;
  }

  return "El servicio de sucursales no está disponible en este momento. Intentá de nuevo en unos minutos.";
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    // Default a "andreani": hoy es el único carrier registrado y los
    // consumidores existentes no mandan `carrier` explícito.
    const carrier = url.searchParams.get("carrier") || "andreani";
    const postalCode = url.searchParams.get("postal_code");
    const serviceTypeParam = url.searchParams.get("service_type");

    if (!postalCode) {
      return NextResponse.json(
        { success: false, message: "postal_code is required", branches: [] },
        { status: 400 },
      );
    }

    const searcher = CARRIER_BRANCH_SEARCHERS[carrier];
    if (!searcher) {
      return NextResponse.json(
        {
          success: false,
          message: `Carrier "${carrier}" no soportado`,
          branches: [],
        },
        { status: 400 },
      );
    }

    const serviceTypeValidator = CARRIER_SERVICE_TYPE_VALIDATORS[carrier];
    if (
      serviceTypeParam &&
      serviceTypeValidator &&
      !serviceTypeValidator(serviceTypeParam)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: CARRIER_SERVICE_TYPE_ERROR[carrier] ?? "service_type is invalid",
          branches: [],
        },
        { status: 400 },
      );
    }

    const normalizedPostalCode = normalizePostalCode(postalCode);
    if (!/^\d{4,5}$/.test(normalizedPostalCode)) {
      return NextResponse.json(
        {
          success: false,
          message: "postal_code is invalid",
          branches: [],
        },
        { status: 400 },
      );
    }

    const branches = await searcher(normalizedPostalCode, serviceTypeParam);

    return NextResponse.json({
      success: true,
      branches,
      count: branches.length,
    });
  } catch (error) {
    console.error("[API] Failed to fetch carrier branches:", error);
    return NextResponse.json(
      {
        success: false,
        message: getErrorMessage(error),
        branches: [],
      },
      { status: 500 },
    );
  }
}
