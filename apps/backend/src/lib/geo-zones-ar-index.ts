/**
 * Índice del catálogo de zonas de Argentina — SÓLO id y nombre.
 *
 * Las geometrías viven en una única copia, en el storefront
 * (`apps/storefront/src/lib/data/geo-zones-ar.ts`), que es el que las necesita
 * para el point-in-polygon. Acá alcanza con los nombres: el schema Zod valida
 * que un `preset` exista y la ficha de la tienda lista las opciones. El admin
 * no previsualiza presets en el mapa, así que no tiene por qué cargarse un
 * cuarto de mega de polígonos.
 *
 * Los ids son los códigos ISO 3166-2:AR en minúscula. Son estables: si mañana
 * mejoramos los polígonos, las tiendas que ya tenían la zona prendida se
 * benefician sin tocar su `content_config` — por eso los presets se guardan por
 * REFERENCIA y no con la geometría inline.
 */
export const GEO_ZONES_AR_INDEX: { id: string; label: string }[] = [
  { id: 'ar-c', label: 'CABA' },
  { id: 'ar-b', label: 'Buenos Aires' },
  { id: 'ar-k', label: 'Catamarca' },
  { id: 'ar-h', label: 'Chaco' },
  { id: 'ar-u', label: 'Chubut' },
  { id: 'ar-x', label: 'Córdoba' },
  { id: 'ar-w', label: 'Corrientes' },
  { id: 'ar-e', label: 'Entre Ríos' },
  { id: 'ar-p', label: 'Formosa' },
  { id: 'ar-y', label: 'Jujuy' },
  { id: 'ar-l', label: 'La Pampa' },
  { id: 'ar-f', label: 'La Rioja' },
  { id: 'ar-m', label: 'Mendoza' },
  { id: 'ar-n', label: 'Misiones' },
  { id: 'ar-q', label: 'Neuquén' },
  { id: 'ar-r', label: 'Río Negro' },
  { id: 'ar-a', label: 'Salta' },
  { id: 'ar-j', label: 'San Juan' },
  { id: 'ar-d', label: 'San Luis' },
  { id: 'ar-z', label: 'Santa Cruz' },
  { id: 'ar-s', label: 'Santa Fe' },
  { id: 'ar-g', label: 'Santiago del Estero' },
  { id: 'ar-v', label: 'Tierra del Fuego' },
  { id: 'ar-t', label: 'Tucumán' },
];

export const GEO_ZONE_AR_IDS = new Set(GEO_ZONES_AR_INDEX.map((zone) => zone.id));

export const geoZoneArLabel = (id: string): string | undefined =>
  GEO_ZONES_AR_INDEX.find((zone) => zone.id === id)?.label;
