/**
 * El id de un tipo de sucursal. Dejó de ser un enum de tres valores: cada
 * tienda define su propia lista en `content_config.sucursales.types` y esto
 * guarda uno de esos ids. Cadena vacía = la sucursal no tiene tipo, que es lo
 * que corresponde en una tienda que no clasifica sus sucursales.
 */
export type StoreLocatorType = string;

/** Un tipo de sucursal tal como lo configuró la tienda. Espejo de `BranchType`. */
export type StoreLocatorCategory = {
  id: string;
  label: string;
  /** Si las sucursales de este tipo se ofrecen como punto de retiro. */
  pickup: boolean;
  color?: string;
};

export type StoreLocatorRegion = string;

export type StoreLocatorGeometry =
  | { type: "Polygon"; coordinates: number[][][] }
  | { type: "MultiPolygon"; coordinates: number[][][][] };

/**
 * Una zona del filtro de ubicación, YA RESUELTA: el template convierte los
 * presets del catálogo argentino a su geometría antes de mandarla al cliente,
 * así el filtrado no tiene que cargarse el catálogo entero en el browser.
 */
export type StoreLocatorZone = {
  id: string;
  label: string;
  geometry: StoreLocatorGeometry;
};

/** Como se persiste en `content_config`: por referencia al catálogo, o con geometría. */
export type StoreLocatorZoneConfig = { id: string; label: string; active?: boolean } & (
  | { preset: string; geometry?: undefined }
  | { geometry: StoreLocatorGeometry; preset?: undefined }
);

export type StoreLocatorLocation = {
  id: string;
  name: string;
  address: string;
  city: string;
  province: string;
  country: string;
  lat: number | null;
  lng: number | null;
  type: StoreLocatorType;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  businessHoursSummary?: string;
  isOpenNow?: boolean;
  images?: string[] | null;
  socialMedia?: {
    instagram?: string | null;
    facebook?: string | null;
    website?: string | null;
    tiktok?: string | null;
    linkedin?: string | null;
  } | null;
};
