/**
 * Fotos de ambiente de un color de la carta.
 *
 * El fabricante publica, por color, una foto por ambiente ("así queda este color
 * en un living"). Son URLs de SU CDN, no assets nuestros: no se bajan ni se
 * suben a Spaces —serían ~25.000 imágenes para 3.132 colores— y por eso se
 * guardan como URL en `erp_tinting_color.metadata.images`.
 *
 * `metadata` y no una columna ni una tabla aparte porque la foto es decorativa:
 * no participa de la clave natural `(collection, code)`, no se filtra ni se
 * ordena por ella, y un color sin fotos es un color perfectamente vendible.
 *
 * El módulo existe para que el import y la ruta store compartan la MISMA
 * validación. La data entra por scraping del sitio del fabricante y sale a un
 * `<img src>` del storefront: si el parser aceptara `javascript:` o `data:`,
 * el import sería el vector. Acá sólo pasan http(s).
 */

export type ColorImage = {
  /** Ambiente tal como lo nombra el fabricante ("Livingroom"). Nulo = sin etiquetar. */
  room: string | null;
  url: string;
};

/**
 * Tope por color. No es un límite del negocio (hoy el fabricante publica 8) sino
 * un freno: una fila mal armada no puede inflar el JSON de un color sin límite.
 */
export const MAX_COLOR_IMAGES = 12;

const MAX_ROOM_LENGTH = 40;

/** Sólo http(s) absolutas. Ver el porqué en el comentario de arriba. */
function normalizeUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

function normalizeRoom(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim().slice(0, MAX_ROOM_LENGTH);
  return value || null;
}

/**
 * Acepta las tres formas en que puede llegar la lista y descarta lo que no sea
 * una URL usable: un color con 7 fotos buenas y una basura entra con 7.
 *
 * - array de `{room, url}` (lo que manda el harvester como JSON)
 * - array de strings (URLs sueltas)
 * - objeto `{Livingroom: url}` (mapa ambiente → foto)
 */
export function normalizeColorImages(input: unknown): ColorImage[] {
  const candidates: ColorImage[] = [];

  if (Array.isArray(input)) {
    for (const item of input) {
      if (typeof item === 'string') {
        candidates.push({ room: null, url: item });
        continue;
      }
      if (item && typeof item === 'object') {
        const record = item as Record<string, unknown>;
        candidates.push({
          room: normalizeRoom(record.room ?? record.ambiente ?? record.label),
          url: typeof record.url === 'string' ? record.url : '',
        });
      }
    }
  } else if (input && typeof input === 'object') {
    for (const [room, url] of Object.entries(input as Record<string, unknown>)) {
      candidates.push({ room: normalizeRoom(room), url: typeof url === 'string' ? url : '' });
    }
  }

  const out: ColorImage[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const url = normalizeUrl(candidate.url);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push({ room: candidate.room, url });
    if (out.length >= MAX_COLOR_IMAGES) break;
  }
  return out;
}

/**
 * Celda de CSV: `Livingroom=https://…|Kitchen=https://…`, o URLs separadas por
 * `|` sin etiqueta. El separador es `|` y no `,` porque el CSV ya usa la coma y
 * un campo entrecomillado con 8 URLs es imposible de revisar a ojo en Excel.
 *
 * También acepta un JSON pegado en la celda, que es lo que sale de exportar el
 * harvester sin pensar demasiado.
 */
export function parseColorImagesCell(raw: string): ColorImage[] {
  const value = raw.trim();
  if (!value) return [];

  if (value.startsWith('[') || value.startsWith('{')) {
    try {
      return normalizeColorImages(JSON.parse(value));
    } catch {
      return [];
    }
  }

  return normalizeColorImages(value.split('|').map(splitRoomAndUrl));
}

/**
 * `Livingroom=https://…` vs `https://…?im=Resize,width=1200`: las dos formas
 * tienen `=`, así que partir por el primero rompe la segunda (la URL con
 * parámetros es EXACTAMENTE la que publica el CDN del fabricante). Sólo cuenta
 * como ambiente lo que parece un nombre: letras, números y separadores simples.
 */
function splitRoomAndUrl(part: string): { room: string | null; url: string } {
  const separator = part.indexOf('=');
  if (separator <= 0) return { room: null, url: part };
  const head = part.slice(0, separator);
  if (!/^[\p{L}\p{N} _.-]+$/u.test(head.trim())) return { room: null, url: part };
  return { room: head, url: part.slice(separator + 1) };
}

/** Lo que la ruta store necesita para devolverlas sin confiar en la forma guardada. */
export function readColorImages(metadata: unknown): ColorImage[] {
  if (!metadata || typeof metadata !== 'object') return [];
  return normalizeColorImages((metadata as Record<string, unknown>).images);
}

/**
 * Cuántas de las filas que se están importando traen fotos, para que el import
 * lo DIGA en vez de dejarlo pasar.
 *
 * Existe por un caso real: en desdeelsur la carta entró completa —2848 colores,
 * con hex, familia y orden— y **ninguno** con fotos, porque la planilla del
 * fabricante no las trae; salen de otra corrida (`scripts/tinting/
 * harvest-alba-colors.mjs`). Nadie se enteró hasta que una clienta preguntó por
 * qué en una tienda se veía el color aplicado en un living y en la otra no.
 *
 * Se calcula acá, sobre las filas ya parseadas, y no con un conteo contra la
 * base: es exacto, no cuesta una query, y sobre todo llega en el ÚNICO momento
 * en que el operador está mirando y puede volver a correr el harvest.
 *
 * `column_present` distingue las dos formas de no tener fotos, que se arreglan
 * distinto: si la columna no vino, falta el harvest; si vino vacía, el harvest
 * corrió y no encontró nada para esos colores.
 */
export type ColorImagesImportSummary = {
  /** Alguna fila traía la columna de fotos (aunque fuera vacía). */
  column_present: boolean;
  with_images: number;
  without_images: number;
};

export function summarizeImportedColorImages(
  rows: Array<{ images: ColorImage[] | null }>
): ColorImagesImportSummary {
  let withImages = 0;
  let columnPresent = false;

  for (const row of rows) {
    // `null` = la planilla no trae la columna; `[]` = la trae vacía.
    if (row.images !== null) columnPresent = true;
    if (row.images && row.images.length > 0) withImages += 1;
  }

  return {
    column_present: columnPresent,
    with_images: withImages,
    without_images: rows.length - withImages,
  };
}

/**
 * Mete las fotos en el `metadata` existente SIN pisar el resto de las claves.
 *
 * Un import que no trae fotos no puede borrar las que ya están: la planilla del
 * fabricante y el harvest de fotos son dos corridas distintas, y un merge plano
 * ya nos borró un watermark en la config del ERP.
 */
export function mergeColorImagesIntoMetadata(
  existing: unknown,
  images: ColorImage[]
): Record<string, unknown> {
  const base =
    existing && typeof existing === 'object' ? { ...(existing as Record<string, unknown>) } : {};
  if (images.length) base.images = images;
  else delete base.images;
  return base;
}
