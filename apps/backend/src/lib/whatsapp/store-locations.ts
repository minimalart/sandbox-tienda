import type { MedusaContainer } from '@medusajs/framework/types';
import { resolveWaOrderContext } from './order-context';

type AnyRecord = Record<string, any>;

/**
 * Sucursales y horarios para el bot (PRD §21).
 *
 * Los datos salen del módulo `store_location`, que YA los tiene todos (nombre,
 * dirección, teléfono, `business_hours`, lat/lng, visibilidad por canal). El PRD
 * pide explícitamente NO consultar Google Maps ni Google Sites en vivo: el link
 * al mapa se arma con las coordenadas guardadas.
 */

export type WaStoreLocation = {
  name: string;
  address: string;
  phone: string | null;
  whatsapp: string | null;
  hours: string[];
  map_url: string | null;
};

const DAY_LABELS: Array<[string, string]> = [
  ['monday', 'Lunes'],
  ['tuesday', 'Martes'],
  ['wednesday', 'Miércoles'],
  ['thursday', 'Jueves'],
  ['friday', 'Viernes'],
  ['saturday', 'Sábado'],
  ['sunday', 'Domingo'],
];

/**
 * `business_hours` es `Record<día, { closed, is24Hours, slots: [{open, close}] }>`.
 * Los días consecutivos con el MISMO horario se agrupan ("Lunes a Viernes 8 a 18")
 * para no mandar siete líneas por sucursal en un mensaje de WhatsApp.
 */
export function formatBusinessHours(raw: unknown): string[] {
  if (!raw || typeof raw !== 'object') return [];
  const hours = raw as AnyRecord;

  const perDay = DAY_LABELS.map(([key, label]) => {
    const day = hours[key] as AnyRecord | undefined;
    if (!day || day.closed === true) return { label, text: 'cerrado' };
    if (day.is24Hours === true) return { label, text: '24 h' };
    const slots = Array.isArray(day.slots) ? (day.slots as AnyRecord[]) : [];
    const text = slots
      .map((s) => (s?.open && s?.close ? `${s.open} a ${s.close}` : null))
      .filter(Boolean)
      .join(' y ');
    return { label, text: text || 'cerrado' };
  });

  const lines: string[] = [];
  let runStart = 0;
  for (let i = 1; i <= perDay.length; i++) {
    const changed = i === perDay.length || perDay[i]!.text !== perDay[runStart]!.text;
    if (!changed) continue;
    const { text } = perDay[runStart]!;
    if (text !== 'cerrado') {
      const from = perDay[runStart]!.label;
      const to = perDay[i - 1]!.label;
      lines.push(runStart === i - 1 ? `${from}: ${text}` : `${from} a ${to}: ${text}`);
    }
    runStart = i;
  }
  return lines;
}

/** Link a Google Maps desde las coordenadas guardadas (nunca se consulta en vivo). */
export function buildMapUrl(location: AnyRecord): string | null {
  const lat = location?.lat;
  const lng = location?.lng;
  if (lat && lng) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
  }
  const parts = [location?.street, location?.city, location?.province].filter(Boolean);
  if (parts.length === 0) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts.join(', '))}`;
}

/**
 * Sucursales visibles del canal de WhatsApp. `sales_channel_ids` vacío o nulo
 * significa "visible en todos los canales" (así lo define el modelo), así que esas
 * también entran.
 */
export async function getWaStoreLocations(
  container: MedusaContainer,
  limit = 5,
): Promise<WaStoreLocation[]> {
  let service: AnyRecord | null = null;
  try {
    // Resuelto por clave y defensivamente: `store-location` es otra extensión y
    // puede no estar instalada.
    service = container.resolve('storeLocation') as AnyRecord;
  } catch {
    return [];
  }

  const ctx = await resolveWaOrderContext(container);
  let rows: AnyRecord[] = [];
  try {
    rows = (await service.listStoreLocations(
      { is_visible: true, active: true },
      { take: 50 },
    )) as AnyRecord[];
  } catch {
    return [];
  }

  const scoped = rows.filter((row) => {
    const channels = row?.sales_channel_ids;
    if (!Array.isArray(channels) || channels.length === 0) return true;
    return channels.includes(ctx.sales_channel_id);
  });

  return scoped.slice(0, limit).map((row) => ({
    name: String(row.name ?? ''),
    address: [row.street, row.city, row.province].filter(Boolean).join(', '),
    phone: (row.phone as string | null) ?? null,
    whatsapp: (row.whatsapp as string | null) ?? null,
    hours: formatBusinessHours(row.business_hours),
    map_url: buildMapUrl(row),
  }));
}

/** Mensaje listo para mandar por WhatsApp (texto, con el link de mapa por sucursal). */
export function formatStoreLocationsMessage(locations: WaStoreLocation[]): string {
  if (locations.length === 0) {
    return 'Por ahora no tengo las sucursales cargadas. Si querés, te paso con alguien del equipo.';
  }
  const blocks = locations.map((loc) => {
    const lines = [`*${loc.name}*`];
    if (loc.address) lines.push(`📍 ${loc.address}`);
    if (loc.phone) lines.push(`📞 ${loc.phone}`);
    for (const h of loc.hours) lines.push(`🕒 ${h}`);
    if (loc.map_url) lines.push(`🗺️ ${loc.map_url}`);
    return lines.join('\n');
  });
  return `Estas son nuestras sucursales:\n\n${blocks.join('\n\n')}`;
}
