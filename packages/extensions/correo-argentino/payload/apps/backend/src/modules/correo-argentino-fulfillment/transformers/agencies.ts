/**
 * `GET /agencies` → shape que consume el storefront.
 *
 * El shape de salida es deliberadamente el MISMO que el que espera hoy la ruta
 * de sucursales del storefront (`{ id, code, name, description, service_type,
 * address, coordinates, contact_info, operating_hours }`), para que el selector
 * de sucursales del checkout sea configuración y no un adapter nuevo.
 *
 * Todo se lee defensivamente: `volumetric_capacity`,
 * `maximum_package_dimensions` y TODO `open_hours` vienen `null` en el ejemplo
 * oficial del manual, así que nada de eso puede ser obligatorio.
 */

import {
  normalizeProvinceToCode,
  normalizePostalCode,
  provinceNameFromCode,
} from './province-codes';
import type { CorreoRawAgency } from '../types';

export interface CorreoAgencyOperatingHours {
  day: string;
  open_time: string | null;
  close_time: string | null;
  is_closed: boolean;
}

export interface CorreoAgency {
  /** `agency_id`: código de planta OPACO de 3 chars (ej. `"SCQ"`). */
  id: string;
  code: string;
  name: string;
  description: string;
  /** Único `deliveryType` con sucursal soportado (`locker` queda fuera). */
  service_type: 'agency';
  status: string | null;
  address: {
    street: string;
    number: string;
    neighborhood: string;
    city: string;
    /** Nombre de la provincia tal como lo devuelve Correo. */
    province: string;
    /** Código de UNA letra, para reusar en `POST /orders`. */
    province_code: string | null;
    postal_code: string;
    country: string;
  };
  coordinates: { latitude: number; longitude: number } | null;
  contact_info: {
    phone: string | null;
    email: string | null;
    owner: string | null;
  };
  /** Derivado de `open_hours`; vacío cuando Correo no lo trae. */
  operating_hours: CorreoAgencyOperatingHours[];
  /** String humano crudo (`"LUN A VIE 08.00 A 14.30"`). */
  schedule: string | null;
  package_reception: boolean;
  pickup_availability: boolean;
  max_package_dimensions: {
    height: number | null;
    length: number | null;
    width: number | null;
    weight: number | null;
  } | null;
  volumetric_capacity: number | null;
  last_updated: string | null;
  deactivation_date: string | null;
}

/** Claves de `open_hours` en el orden en el que se muestran. */
export const CORREO_OPEN_HOURS_KEYS: ReadonlyArray<string> = Object.freeze([
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
  'holidays',
]);

type UnknownRecord = Record<string, unknown>;

export function transformCorreoAgencies(
  raw: ReadonlyArray<CorreoRawAgency>
): CorreoAgency[] {
  return (raw ?? [])
    .filter((agency): agency is CorreoRawAgency => isRecord(agency))
    .map(transformCorreoAgency);
}

export function transformCorreoAgency(raw: CorreoRawAgency): CorreoAgency {
  const location = rec(raw, 'location') ?? {};
  const geo = rec(location, 'geolocation');
  const maxDimensions = rec(raw, 'maximum_package_dimensions');

  const provinceName = str(location, 'state_name');
  const provinceCode = normalizeProvinceToCode(provinceName);

  const agencyId = str(raw, 'agency_id') ?? '';
  const agencyName = str(raw, 'agency_name') ?? agencyId;

  return {
    id: agencyId,
    code: agencyId,
    name: agencyName,
    description: buildDescription(agencyName, location),
    service_type: 'agency',
    status: str(raw, 'status') ?? null,
    address: {
      street: str(location, 'street_name') ?? '',
      number: strOrNum(location, 'street_number') ?? '',
      neighborhood: str(location, 'neighborhood_name') ?? '',
      city: str(location, 'city_name') ?? '',
      province:
        provinceName ??
        (provinceCode ? provinceNameFromCode(provinceCode) ?? '' : ''),
      province_code: provinceCode ?? null,
      postal_code: normalizePostalCode(strOrNum(location, 'zip_code')) ?? '',
      country: str(location, 'country_name') ?? 'AR',
    },
    coordinates: parseCoordinates(geo),
    contact_info: {
      phone: str(raw, 'phone') ?? null,
      email: str(raw, 'email') ?? null,
      owner: str(raw, 'owner') ?? null,
    },
    operating_hours: parseOpenHours(rec(raw, 'open_hours')),
    schedule: str(raw, 'schedule') ?? null,
    // Los dos flags son también los filtros de `GET /agencies`. Se leen como
    // boolean explícito: `undefined` no es "sí".
    package_reception: bool(raw, 'package_reception'),
    pickup_availability: bool(raw, 'pickup_availability'),
    max_package_dimensions: maxDimensions
      ? {
          height: num(maxDimensions, 'height'),
          length: num(maxDimensions, 'length'),
          width: num(maxDimensions, 'width'),
          weight: num(maxDimensions, 'weight'),
        }
      : null,
    volumetric_capacity: num(raw as UnknownRecord, 'volumetric_capacity'),
    last_updated: str(raw, 'last_updated') ?? null,
    deactivation_date: str(raw, 'deactivation_date') ?? null,
  };
}

/**
 * Si la sucursal está operativa. `agency_id` vacío la descalifica: sin el código
 * de planta no se puede dar de alta el envío.
 */
export function isCorreoAgencyOperational(agency: CorreoAgency): boolean {
  if (!agency.id) return false;
  if (agency.deactivation_date) return false;

  const status = agency.status?.trim().toUpperCase();
  if (!status) return true;
  return status !== 'INACTIVE' && status !== 'INACTIVA' && status !== 'BAJA';
}

/**
 * Parsea una entrada de `open_hours`. El manual no documenta el formato (todas
 * las claves vienen `null` en el ejemplo), así que se aceptan las formas
 * plausibles: `"08:00-14:30"`, `"08.00 A 14.30"` o `{ open, close }`. Si no se
 * puede extraer un par de horas, el día queda con las horas en `null` y el
 * consumidor cae al `schedule` humano.
 */
export function parseAgencyDayHours(
  day: string,
  value: unknown
): CorreoAgencyOperatingHours {
  if (value == null) {
    return { day, open_time: null, close_time: null, is_closed: true };
  }

  if (isRecord(value)) {
    const open = str(value, 'open') ?? str(value, 'open_time') ?? str(value, 'from');
    const close =
      str(value, 'close') ?? str(value, 'close_time') ?? str(value, 'to');
    return {
      day,
      open_time: open ?? null,
      close_time: close ?? null,
      is_closed: !open && !close,
    };
  }

  const text = String(value).trim();
  if (text.length === 0 || /^(cerrado|closed)$/i.test(text)) {
    return { day, open_time: null, close_time: null, is_closed: true };
  }

  const times = text.match(/\d{1,2}[.:]\d{2}/g) ?? [];
  const open = times[0] ? times[0].replace('.', ':') : null;
  const close = times[1] ? times[1].replace('.', ':') : null;

  return { day, open_time: open, close_time: close, is_closed: false };
}

/**
 * ⚠️ SEGÚN EL MANUAL (sin verificar): en el único ejemplo de respuesta de
 * `GET /agencies`, `open_hours` viene con las 8 claves presentes y **todas en
 * `null`**. Cuánto se repite eso en el padrón real está por verificar en QA.
 * Devolver los 8 días con `is_closed: true` sería literalmente cierto y
 * prácticamente una mentira: el checkout mostraría "cerrado toda la semana"
 * para cada sucursal que venga así.
 *
 * Cuando no hay un solo día con datos se devuelve `[]`, que es la señal
 * inequívoca de "Correo no informa horarios" y empuja al consumidor al string
 * humano de `schedule` (`"LUN A VIE 08.00 A 14.30"`), que sí viene poblado.
 */
function parseOpenHours(openHours: UnknownRecord | undefined): CorreoAgencyOperatingHours[] {
  if (!openHours) return [];

  const present = CORREO_OPEN_HOURS_KEYS.filter((key) => key in openHours);
  if (present.every((key) => openHours[key] == null)) return [];

  return present.map((key) => parseAgencyDayHours(key, openHours[key]));
}

function buildDescription(name: string, location: UnknownRecord): string {
  const parts = [
    name,
    str(location, 'city_name'),
    str(location, 'state_name'),
  ].filter((part): part is string => Boolean(part));
  return parts.join(' — ');
}

function parseCoordinates(
  geo: UnknownRecord | undefined
): { latitude: number; longitude: number } | null {
  if (!geo) return null;
  const latitude = num(geo, 'latitude');
  const longitude = num(geo, 'longitude');
  return latitude !== null && longitude !== null ? { latitude, longitude } : null;
}

// --- helpers ---

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function rec(source: UnknownRecord, key: string): UnknownRecord | undefined {
  const value = source[key];
  return isRecord(value) ? value : undefined;
}

function str(source: UnknownRecord, key: string): string | undefined {
  const value = source[key];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Correo devuelve `street_number` y `zip_code` a veces como number. */
function strOrNum(source: UnknownRecord, key: string): string | undefined {
  const value = source[key];
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return str(source, key);
}

function num(source: UnknownRecord, key: string): number | null {
  const value = source[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function bool(source: UnknownRecord, key: string): boolean {
  const value = source[key];
  return value === true || value === 'true';
}
