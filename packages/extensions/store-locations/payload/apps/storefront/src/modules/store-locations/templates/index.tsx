import type {
  BusinessHours,
  PublicStoreLocation,
} from "@lib/data/store-locations";
import { GEO_ZONES_AR_BY_ID } from "@lib/data/geo-zones-ar";
import { getActiveTenant } from "@lib/site-config/active-tenant";
import type {
  StoreLocatorLocation,
  StoreLocatorZone,
  StoreLocatorZoneConfig,
} from "@lib/types/store-locator";
import { resolveBranchTypes } from "@lib/util/branch-types";
import StoreLocatorClient from "../components/store-locator-client";
import { summarizeBusinessHours } from "../utils/business-hours";

type StoreLocationsTemplateProps = {
  locations: PublicStoreLocation[];
};

/**
 * Copy por defecto del subtítulo. La demo puede reemplazarlo desde el admin
 * (Contenido → Página de sucursales) o vaciarlo para no mostrarlo.
 */
const DEFAULT_SUBTITLE =
  "Buscá por ubicación, filtrá por tipo de sucursal y encontrá el punto más conveniente para comprar o retirar.";

/**
 * Zonas persistidas → zonas con geometría, resueltas EN EL SERVIDOR.
 *
 * Los presets del catálogo argentino se guardan por referencia
 * (`{ preset: 'ar-b' }`) para no meter 130 KB de polígonos en el
 * `content_config` de cada tienda. Al cliente le llegan ya resueltas, así que
 * el filtrado (`use-store-locator-filters`) no cambia y el catálogo entero
 * nunca viaja al browser: sólo las zonas que la tienda prendió.
 *
 * Una zona apagada (`active: false`) o un preset que ya no existe en el
 * catálogo se descartan en silencio: son datos viejos, no un error que el
 * visitante pueda hacer algo por resolver.
 */
const resolveZones = (zones?: StoreLocatorZoneConfig[]): StoreLocatorZone[] =>
  (zones ?? [])
    .filter((zone) => zone.active !== false)
    .flatMap((zone) => {
      if (zone.geometry) return [{ id: zone.id, label: zone.label, geometry: zone.geometry }];
      const preset = zone.preset ? GEO_ZONES_AR_BY_ID.get(zone.preset) : undefined;
      return preset ? [{ id: zone.id, label: zone.label, geometry: preset.geometry }] : [];
    });

const DAY_KEYS = [
  "domingo",
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
] as const;

const parseTimeToMinutes = (value: string) => {
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }
  return hours * 60 + minutes;
};

const isLocationOpenNow = (hours: BusinessHours | null | undefined) => {
  if (!hours) {
    return undefined;
  }

  const now = new Date();
  const currentDay = DAY_KEYS[now.getDay()];
  const currentEntry = hours[currentDay];

  if (!currentEntry || currentEntry.closed) {
    return false;
  }
  if (currentEntry.is24Hours) {
    return true;
  }

  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  return (currentEntry.slots ?? []).some((slot) => {
    const open = parseTimeToMinutes(slot.open);
    const close = parseTimeToMinutes(slot.close);

    if (open === null || close === null) {
      return false;
    }
    if (close < open) {
      return nowMinutes >= open || nowMinutes <= close;
    }
    return nowMinutes >= open && nowMinutes <= close;
  });
};

const parseCoordinate = (value: string | null) => {
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toLocatorLocation = (
  location: PublicStoreLocation
): StoreLocatorLocation => {
  const address = [location.street, location.city, location.province]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");
  const hoursSummary = summarizeBusinessHours(location.business_hours).join(
    " | "
  );

  return {
    address,
    businessHoursSummary: hoursSummary || undefined,
    city: location.city,
    country: "",
    email: location.email,
    id: location.id,
    images: location.images,
    isOpenNow: isLocationOpenNow(location.business_hours),
    lat: parseCoordinate(location.lat),
    lng: parseCoordinate(location.lng),
    name: location.name,
    phone: location.phone,
    province: location.province,
    socialMedia: location.social,
    type: location.store_type,
    whatsapp: location.whatsapp,
  };
};

export default async function StoreLocationsTemplate({
  locations,
}: StoreLocationsTemplateProps) {
  const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY ?? "";
  const stores = locations.map(toLocatorLocation);
  const tenant = await getActiveTenant();
  const config = tenant.assets.sucursales;
  // Ausente = default; cadena vacía = el demo eligió ocultar el subtítulo.
  const subtitle = config?.subtitle ?? DEFAULT_SUBTITLE;
  const layout = config?.layout ?? "full";

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 pb-20 sm:px-6 lg:px-8 lg:py-14">
      {stores.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-16 text-center">
          <p className="font-medium text-gray-900">
            Todavía no hay sucursales publicadas
          </p>
          <p className="mt-1 text-gray-600 text-sm">
            Volve a consultar pronto: estamos actualizando nuestra red de
            sucursales.
          </p>
        </div>
      ) : (
        <StoreLocatorClient
          googleMapsApiKey={googleMapsApiKey}
          layout={layout}
          regions={resolveZones(config?.regions)}
          categories={resolveBranchTypes(config)}
          showCategoryFilters={config?.showCategoryFilters !== false}
          showLocationFilters={config?.showLocationFilters !== false}
          stores={stores}
          subtitle={subtitle}
        />
      )}
    </section>
  );
}
