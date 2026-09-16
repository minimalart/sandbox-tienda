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

/** Minúsculas sin tildes, para comparar lo que escribe el cliente con la base. */
const foldPlace = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

/**
 * Cómo le dice la gente a una provincia cuando no la escribe entera.
 *
 * El orden importa: se prueba de MÁS específico a menos. "capital federal" tiene
 * que resolver a CABA antes de que "buenos aires" —que está contenido en el nombre
 * de la provincia de CABA— la confunda con la provincia.
 */
const PROVINCE_ALIASES: Array<{ canonical: string; aliases: string[] }> = [
  {
    canonical: 'ciudad autonoma de buenos aires',
    aliases: ['caba', 'capital federal', 'ciudad de buenos aires', 'capital'],
  },
  {
    canonical: 'buenos aires',
    aliases: ['pba', 'provincia de buenos aires', 'bs as', 'bsas', 'gba', 'conurbano'],
  },
];

/** La provincia que nombró el cliente con un alias, o `null` si no usó ninguno. */
export function resolveProvinceAlias(text: string): string | null {
  const folded = foldPlace(text);
  for (const { canonical, aliases } of PROVINCE_ALIASES) {
    // Con límite de palabra: "capital" no tiene que saltar dentro de "capitalismo",
    // ni "gba" dentro de un código de producto.
    if (aliases.some((alias) => new RegExp(`(^|[^a-z0-9])${alias}([^a-z0-9]|$)`).test(folded))) {
      return canonical;
    }
  }
  return null;
}

type PlaceRow = { name?: unknown; city?: unknown; province?: unknown };

/**
 * Las sucursales del lugar que nombró el cliente. Si no nombró ninguno —o ninguna
 * coincide— devuelve la lista entera, que es el comportamiento de siempre.
 *
 * Existe porque "¿tienen sucursales en pba?" devolvía las cinco primeras del
 * abecedario, con CABA incluida y sin mirar la pregunta: el router matcheaba la
 * palabra "sucursales" y tiraba el listado sin leer el resto.
 */
export function filterLocationsByPlace<T extends PlaceRow>(rows: T[], text: string | null): T[] {
  if (!text) return rows;
  const folded = foldPlace(text);

  const province = resolveProvinceAlias(text);
  if (province) {
    // Comparación EXACTA contra la provincia: por inclusión, "buenos aires" se
    // llevaría puestas las de "ciudad autónoma de buenos aires".
    const exact = rows.filter((row) => foldPlace(String(row.province ?? '')) === province);
    if (exact.length > 0) return exact;
  }

  // Sin alias: alcanza con que la pregunta mencione la ciudad o el nombre de la
  // sucursal. Se piden 4 caracteres para que un nombre corto no matchee por azar.
  const byName = rows.filter((row) =>
    [row.city, row.name, row.province]
      .filter(Boolean)
      .map((v) => foldPlace(String(v)))
      .some((needle) => needle.length >= 4 && folded.includes(needle)),
  );
  return byName.length > 0 ? byName : rows;
}

/**
 * Sucursales visibles del canal de WhatsApp. `sales_channel_ids` vacío o nulo
 * significa "visible en todos los canales" (así lo define el modelo), así que esas
 * también entran.
 *
 * `near` es el texto tal cual lo escribió el cliente: si nombra una ciudad o una
 * provincia, se devuelven SÓLO esas sucursales.
 */
export async function getWaStoreLocations(
  container: MedusaContainer,
  limit = 5,
  near: string | null = null,
): Promise<{ locations: WaStoreLocation[]; total: number; narrowed: boolean }> {
  let service: AnyRecord | null = null;
  try {
    // Resuelto por clave y defensivamente: `store-location` es otra extensión y
    // puede no estar instalada.
    service = container.resolve('storeLocation') as AnyRecord;
  } catch {
    return { locations: [], total: 0, narrowed: false };
  }

  const ctx = await resolveWaOrderContext(container);
  let rows: AnyRecord[] = [];
  try {
    rows = (await service.listStoreLocations(
      { is_visible: true, active: true },
      { take: 50 },
    )) as AnyRecord[];
  } catch {
    return { locations: [], total: 0, narrowed: false };
  }

  const scoped = rows.filter((row) => {
    const channels = row?.sales_channel_ids;
    if (!Array.isArray(channels) || channels.length === 0) return true;
    return channels.includes(ctx.sales_channel_id);
  });

  const picked = filterLocationsByPlace(scoped, near);
  const narrowed = picked.length < scoped.length;
  // Cuando el cliente nombró un lugar se muestran más: pidió por una zona concreta
  // y cortarle la lista en cinco lo deja sin la sucursal que busca.
  const take = narrowed ? Math.max(limit, 8) : limit;

  return {
    total: scoped.length,
    narrowed,
    locations: picked.slice(0, take).map((row) => ({
      name: String(row.name ?? ''),
      address: [row.street, row.city, row.province].filter(Boolean).join(', '),
      phone: (row.phone as string | null) ?? null,
      whatsapp: (row.whatsapp as string | null) ?? null,
      hours: formatBusinessHours(row.business_hours),
      map_url: buildMapUrl(row),
    })),
  };
}

/** Mensaje listo para mandar por WhatsApp (texto, con el link de mapa por sucursal). */
export function formatStoreLocationsMessage(
  locations: WaStoreLocation[],
  opts: { total?: number; narrowed?: boolean } = {},
): string {
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

  const encabezado = opts.narrowed
    ? locations.length === 1
      ? 'Encontré esta sucursal:'
      : `Encontré ${locations.length} sucursales por esa zona:`
    : 'Estas son nuestras sucursales:';

  // Sin esta línea, un cliente al que le mostramos 5 de 20 se queda pensando que
  // son todas las que hay y que la suya no existe.
  const total = opts.total ?? locations.length;
  const cola =
    !opts.narrowed && total > locations.length
      ? `\n\nTenemos ${total} sucursales en total. Decime tu ciudad o provincia y te paso la más cercana. 📍`
      : '';

  return `${encabezado}\n\n${blocks.join('\n\n')}${cola}`;
}
