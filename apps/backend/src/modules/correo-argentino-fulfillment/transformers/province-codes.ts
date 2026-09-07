/**
 * Códigos de provincia de Correo Argentino — DOS convenciones distintas.
 *
 * `POST /orders` usa `state` = código de UNA letra (`"B"`, `"C"`, ...).
 * `GET /agencies` filtra por `stateId` = ISO 3166-2 (`"AR-B"`, `"AR-C"`, ...).
 * No son lo mismo y hay que mapear en las dos direcciones.
 *
 * Dos trampas que son un 400 garantizado:
 *  1. `B` (Provincia de Buenos Aires) y `C` (CABA) son provincias DISTINTAS.
 *     Cualquier normalización que las confunda rompe el alta del envío.
 *  2. `zipCode` se valida CONTRA `state` del lado de Correo: un CP que no
 *     corresponde a la provincia es 400, no un warning.
 *
 * La tabla sale del manual `apiPaqAr-v2.pdf` pág. 12 y coincide con ISO 3166-2:AR
 * (misma letra), por eso la conversión a ISO es un simple prefijo `AR-`.
 */

export type CorreoProvinceCode =
  | 'A'
  | 'B'
  | 'C'
  | 'D'
  | 'E'
  | 'F'
  | 'G'
  | 'H'
  | 'J'
  | 'K'
  | 'L'
  | 'M'
  | 'N'
  | 'P'
  | 'Q'
  | 'R'
  | 'S'
  | 'T'
  | 'U'
  | 'V'
  | 'W'
  | 'X'
  | 'Y'
  | 'Z';

/** Código de una letra → nombre oficial de la provincia. */
export const CORREO_PROVINCE_NAMES: Readonly<
  Record<CorreoProvinceCode, string>
> = Object.freeze({
  A: 'Salta',
  B: 'Provincia de Buenos Aires',
  C: 'Ciudad Autónoma de Buenos Aires',
  D: 'San Luis',
  E: 'Entre Ríos',
  F: 'La Rioja',
  G: 'Santiago del Estero',
  H: 'Chaco',
  J: 'San Juan',
  K: 'Catamarca',
  L: 'La Pampa',
  M: 'Mendoza',
  N: 'Misiones',
  P: 'Formosa',
  Q: 'Neuquén',
  R: 'Río Negro',
  S: 'Santa Fe',
  T: 'Tucumán',
  U: 'Chubut',
  V: 'Tierra del Fuego',
  W: 'Corrientes',
  X: 'Córdoba',
  Y: 'Jujuy',
  Z: 'Santa Cruz',
});

export const CORREO_PROVINCE_CODES: ReadonlyArray<CorreoProvinceCode> =
  Object.freeze(Object.keys(CORREO_PROVINCE_NAMES) as CorreoProvinceCode[]);

/**
 * Normaliza un texto de provincia a una clave comparable: minúsculas, sin
 * acentos, sin nada que no sea alfanumérico. `"Río Negro"`, `"RIO NEGRO"` y
 * `"río-negro"` colapsan a `"rionegro"`.
 */
function normalizeKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Variantes de nombre → código. Match EXACTO sobre la clave normalizada (no
 * substring): `"buenosaires"` es substring de
 * `"ciudadautonomadebuenosaires"`, y un match parcial mandaría los envíos de
 * CABA a Provincia (y viceversa).
 */
const PROVINCE_ALIASES: Readonly<Record<string, CorreoProvinceCode>> =
  Object.freeze({
    // A — Salta
    salta: 'A',
    // B — Provincia de Buenos Aires
    buenosaires: 'B',
    provinciadebuenosaires: 'B',
    pciadebuenosaires: 'B',
    pba: 'B',
    bsas: 'B',
    gba: 'B',
    // C — Ciudad Autónoma de Buenos Aires
    ciudadautonomadebuenosaires: 'C',
    ciudaddebuenosaires: 'C',
    ciudadbuenosaires: 'C',
    cdadautdebuenosaires: 'C',
    caba: 'C',
    capitalfederal: 'C',
    // D — San Luis
    sanluis: 'D',
    // E — Entre Ríos
    entrerios: 'E',
    // F — La Rioja
    larioja: 'F',
    // G — Santiago del Estero
    santiagodelestero: 'G',
    santiagoestero: 'G',
    sgodelestero: 'G',
    // H — Chaco
    chaco: 'H',
    // J — San Juan
    sanjuan: 'J',
    // K — Catamarca
    catamarca: 'K',
    // L — La Pampa
    lapampa: 'L',
    // M — Mendoza
    mendoza: 'M',
    // N — Misiones
    misiones: 'N',
    // P — Formosa
    formosa: 'P',
    // Q — Neuquén
    neuquen: 'Q',
    // R — Río Negro
    rionegro: 'R',
    // S — Santa Fe
    santafe: 'S',
    // T — Tucumán
    tucuman: 'T',
    // U — Chubut
    chubut: 'U',
    // V — Tierra del Fuego
    tierradelfuego: 'V',
    tierradelfuegoantartidaeislasdelatlanticosur: 'V',
    tierradelfuegoantartidaeislasdelatlanticosurargentino: 'V',
    // W — Corrientes
    corrientes: 'W',
    // X — Córdoba
    cordoba: 'X',
    // Y — Jujuy
    jujuy: 'Y',
    // Z — Santa Cruz
    santacruz: 'Z',
  });

export function isCorreoProvinceCode(value: unknown): value is CorreoProvinceCode {
  return (
    typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(CORREO_PROVINCE_NAMES, value)
  );
}

/** Código de una letra → nombre oficial. */
export function provinceNameFromCode(code: string): string | undefined {
  const upper = code?.trim().toUpperCase();
  return isCorreoProvinceCode(upper) ? CORREO_PROVINCE_NAMES[upper] : undefined;
}

/**
 * Nombre (o variante conocida) → código de una letra. Tolerante a acentos,
 * mayúsculas y a las abreviaturas que llegan del checkout ("CABA", "Capital
 * Federal", "Bs As").
 */
export function provinceCodeFromName(
  name: string
): CorreoProvinceCode | undefined {
  if (typeof name !== 'string') return undefined;
  const key = normalizeKey(name);
  if (key.length === 0) return undefined;
  return PROVINCE_ALIASES[key];
}

/** Código de una letra → ISO 3166-2 (`"B"` → `"AR-B"`). */
export function provinceCodeToIso(code: string): string | undefined {
  const upper = code?.trim().toUpperCase();
  return isCorreoProvinceCode(upper) ? `AR-${upper}` : undefined;
}

/** ISO 3166-2 → código de una letra (`"ar-b"` → `"B"`). */
export function provinceCodeFromIso(iso: string): CorreoProvinceCode | undefined {
  if (typeof iso !== 'string') return undefined;
  const match = iso.trim().toUpperCase().match(/^AR-([A-Z])$/);
  const code = match?.[1];
  return isCorreoProvinceCode(code) ? code : undefined;
}

/**
 * Resuelve cualquier representación de provincia (código de una letra, ISO
 * 3166-2 o nombre/variante) al código de una letra que exige `POST /orders`.
 * Devuelve `undefined` cuando no se puede resolver — el caller decide si eso es
 * un error (lo es: el manual marca `state` como requerido, así que mandarlo
 * vacío debería ser rechazado).
 */
export function normalizeProvinceToCode(
  value: string | null | undefined
): CorreoProvinceCode | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;

  if (trimmed.length === 1) {
    const upper = trimmed.toUpperCase();
    return isCorreoProvinceCode(upper) ? upper : undefined;
  }

  return provinceCodeFromIso(trimmed) ?? provinceCodeFromName(trimmed);
}

// Acá vivía `normalizeProvinceToStateId()`, que resolvía la provincia al ISO
// 3166-2 porque el manual dice que `GET /agencies` lo pide así. Se eliminó por
// una INFERENCIA, no por una prueba: asumimos que `/agencies` quiere la MISMA
// letra que `POST /orders` y que la API no usa dos convenciones para el mismo
// dato. Nunca se ejercitó contra la API real.
//
// PENDIENTE DE VERIFICAR EN QA. Si `/agencies` resulta querer el ISO, hay que
// volver a agregarla: `provinceCodeFromIso()` (arriba) hace la mitad del camino
// —ISO → letra—, así que falta la inversa (letra/nombre → `"AR-X"`), que sobre
// `normalizeProvinceToCode()` es un `'AR-' + code`. El único consumidor sería
// `buildAgencyParams()` en `clients/paqar-client.ts`, donde está documentado el
// cambio de una convención a la otra.

/**
 * Normaliza un código postal argentino al CP de 4 dígitos.
 *
 * El carrito puede traer un CPA completo (`"C1121AAF"`); Correo espera los 4
 * dígitos en `zipCode` y en `postalCodeDestination` de `/rates`. Mismo patrón
 * que `normalizePostalCode()` de `andreani-fulfillment/client.ts`.
 */
export function normalizePostalCode(
  postalCode: string | null | undefined
): string | undefined {
  if (typeof postalCode !== 'string' || postalCode.trim().length === 0) {
    return undefined;
  }
  const trimmed = postalCode.trim().toUpperCase();
  const cpaMatch = trimmed.match(/^[A-Z]?(\d{4})[A-Z]{0,3}$/);
  return cpaMatch?.[1] ?? trimmed;
}
