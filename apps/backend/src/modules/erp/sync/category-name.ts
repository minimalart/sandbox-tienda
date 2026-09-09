import { DEFAULT_TITLE_DICTIONARY } from './product-title';

/**
 * Normalización de NOMBRES de categoría del ERP.
 *
 * Zeus —y los sistemas de gestión en general— devuelve el árbol en MAYÚSCULAS
 * SOSTENIDAS y sin tildes ("PAREDES INTERIOR", "HERRAMIENTAS ELECTRICAS"). Eso
 * es cómo se cargó en el ERP, no una decisión editorial, pero el nombre se
 * muestra tal cual en el storefront: breadcrumb y chips del PDP, filtros del PLP
 * y menú de categorías. Al lado del resto del contenido canta.
 *
 * Tres piezas con roles distintos:
 *
 * - `normalizeCategoryName` da formato a los nombres que se escriben en Medusa:
 *   casing de lectura, tildes por diccionario y, para los pocos nombres que
 *   además necesitan una reescritura editorial, un override del nombre completo.
 * - `sameCategoryName` decide si dos nombres son "el mismo" salvo caso y tildes.
 * - `categoryNameNeedsUpdate` es la pregunta que hace el planner: no "¿el ERP
 *   dice algo distinto?" sino "¿lo que está guardado ya es lo que yo
 *   escribiría?". Ver más abajo por qué la diferencia importa.
 *
 * ## Por qué las tildes ahora SÍ las pone el código
 *
 * La versión original de este módulo no las ponía a propósito: "no hay forma de
 * saber que ELECTRICAS lleva tilde sin un diccionario", así que el casing lo
 * arreglaba el código y la ortografía la corregía un humano una vez.
 *
 * Diccionario es justamente lo que hay. `DEFAULT_TITLE_DICTIONARY` ya acentúa
 * los términos del rubro para los títulos de producto, y se reusa acá por la
 * misma razón por la que `product-description.ts` reusa `applyReadingCase`: el
 * día que alguien agregue "poliuretánico" al diccionario, la categoría tiene que
 * corregirse igual que el nombre del producto. Importarlo no cambia
 * `titleRulesFingerprint` —sólo se lee—, así que sumar una palabra de categoría
 * en `CATEGORY_DICTIONARY_EXTRA` NO dispara una reescritura de títulos.
 *
 * La escotilla manual sigue en pie: lo que un humano corrija en el admin gana
 * sobre el ERP, porque `categoryNameNeedsUpdate` compara contra el nombre YA
 * normalizado y no contra el crudo.
 */

/**
 * Términos que sólo aparecen en la carta de categorías, no en los títulos de
 * producto. Se mezclan SOBRE `DEFAULT_TITLE_DICTIONARY`.
 *
 * Las claves van PLEGADAS (minúsculas, sin tildes) y cada término está acá
 * porque aparece en el árbol real de Zeus, no por inventario: las seis palabras
 * base salen de las 42 categorías de desdeelsur (`artistica`, `mascaras`,
 * `electricas`, `nautica`, `perfileria`; `espatulas` ya venía del diccionario de
 * títulos). Las variantes de número acompañan porque el ERP alterna singular y
 * plural para el mismo rubro.
 */
export const CATEGORY_DICTIONARY_EXTRA: Record<string, string> = {
  artistica: 'artística',
  artisticas: 'artísticas',
  artistico: 'artístico',
  artisticos: 'artísticos',
  mascara: 'máscara',
  mascaras: 'máscaras',
  electrica: 'eléctrica',
  electricas: 'eléctricas',
  electrico: 'eléctrico',
  electricos: 'eléctricos',
  nautica: 'náutica',
  nauticas: 'náuticas',
  nautico: 'náutico',
  nauticos: 'náuticos',
  perfileria: 'perfilería',
  perfilerias: 'perfilerías',
  // Términos que sólo aparecen en la carta de FAMILIAS de Zeus (DESDEELSUR-48).
  // Salen de medir las 36 familias reales de desdeelsur, no de inventario.
  explosion: 'explosión',
  proteccion: 'protección',
  construccion: 'construcción',
  clasico: 'clásico',
  clasica: 'clásica',
  clasicos: 'clásicos',
  clasicas: 'clásicas',
  // El diccionario de títulos tiene `acrilico`/`acrilica` pero no los plurales,
  // y las familias los usan (`ARTISTICA ACRILICOS`, `… BASES ACRILICAS`).
  acrilicos: 'acrílicos',
  acrilicas: 'acrílicas',
  // Siglas del rubro que el diccionario de títulos no tiene.
  pu: 'PU',
  spc: 'SPC',
};

/**
 * Diccionario efectivo de categorías: el del título más los términos de arriba.
 *
 * Trae también las siglas (`pvc → PVC`, `mdf → MDF`…), que antes vivían en una
 * lista `ACRONYMS` propia de este módulo. Una sola tabla, un solo lugar donde
 * agregar.
 */
export const CATEGORY_DICTIONARY: Record<string, string> = {
  ...DEFAULT_TITLE_DICTIONARY,
  ...CATEGORY_DICTIONARY_EXTRA,
};

/**
 * Nombres que necesitan MÁS que ortografía: la puntuación con la que el ERP
 * separa una enumeración no se lee bien en un breadcrumb.
 *
 * Clave = nombre COMPLETO del ERP plegado; valor = el nombre final, tal cual va
 * a la base. Un diccionario de palabras no puede hacer esto: mueve separadores y
 * agrega conjunciones.
 *
 * Es deliberadamente una lista corta y cerrada. Sólo entran los nombres que el
 * cliente pidió reescribir; los demás separadores del ERP se conservan
 * (`Masilla - enduido y yeso`, `Primers - fondos`), porque cambiarlos sin que
 * nadie lo pida es decidir por el cliente.
 */
export const CATEGORY_NAME_OVERRIDES: Record<string, string> = {
  'llanas - espatulas - fratachos': 'Llanas, espátulas y fratachos',
  'perfileria metal - madera': 'Perfilería: metal y madera',
};

const collapse = (input: string): string => input.trim().replace(/\s+/g, ' ');

/** Sin tildes, sin caso, sin espacios de más: la forma que se compara. */
function fold(input: string): string {
  return collapse(input)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/**
 * `true` si los dos nombres son el mismo salvo caso, tildes y espacios. Un
 * cambio solo cosmético NO es un rename: el ERP no gana contra la base.
 */
export function sameCategoryName(a: string, b: string): boolean {
  return fold(a) === fold(b);
}

/**
 * Aplica el diccionario sobre un nombre ya en minúsculas.
 *
 * Matchea por PALABRA plegada, igual que el diccionario del título: así un
 * término ya corregido ("eléctricas") vuelve a matchear y mapea a sí mismo, que
 * es lo que sostiene la idempotencia.
 *
 * Recorre las palabras con un regex y NO partiendo por espacios. La diferencia
 * importa: el ERP separa enumeraciones con comas y sin espacio antes, así que
 * partir por espacios deja el token `espatulas,` —con la coma pegada— que no
 * matchea la clave `espatulas` y la palabra se queda sin tilde. Es el mismo
 * motivo por el que `product-description.ts` procesa la prosa por tramos en vez
 * de una sola pasada. Los separadores (`-`, `,`, `:`) quedan intactos porque el
 * regex sólo toca corridas de letras y dígitos.
 */
function applyGroupingDictionary(name: string): string {
  return name.replace(/[\p{L}\p{N}]+/gu, (word) => CATEGORY_DICTIONARY[fold(word)] ?? word);
}

/**
 * Motor de formato de una etiqueta de agrupación del ERP: casing de lectura más
 * tildes y siglas del diccionario.
 *
 * Lo comparten las CATEGORÍAS y las FAMILIAS (`product-family.ts`). Las dos son
 * lo mismo desde acá: una etiqueta que Zeus manda en mayúsculas sostenidas y sin
 * tildes, y que el storefront muestra tal cual en un filtro o un breadcrumb. Lo
 * que NO comparten son los overrides de nombre completo, que son por eje.
 *
 * Si el ERP ya mandó algo con minúsculas se respeta tal cual: alguien se tomó el
 * trabajo de escribirlo bien.
 */
export function normalizeErpGroupingLabel(raw: string): string {
  const name = collapse(raw);
  if (!name) return name;

  // Tiene minúsculas → ya viene con un formato intencional, no se toca.
  if (name !== name.toUpperCase()) return name;

  const lowered = applyGroupingDictionary(name.toLowerCase());

  // Mayúscula en la primera letra del nombre (no de cada palabra: en español
  // "Lacas y barnices" es correcto y "Lacas Y Barnices" no).
  const first = lowered.search(/[\p{L}\p{N}]/u);
  if (first === -1) return lowered;
  return lowered.slice(0, first) + lowered[first]!.toUpperCase() + lowered.slice(first + 1);
}

/**
 * Nombre de CATEGORÍA listo para mostrar: el override editorial si hay uno, y si
 * no el motor de arriba.
 */
export function normalizeCategoryName(raw: string): string {
  const name = collapse(raw);
  if (!name) return name;

  // Reescritura editorial declarada: gana sobre todo lo demás, incluido el
  // early-return por minúsculas del motor. Se consulta por forma plegada para
  // que dé igual cómo venga escrito el nombre del ERP.
  const override = CATEGORY_NAME_OVERRIDES[fold(name)];
  if (override) return override;

  return normalizeErpGroupingLabel(name);
}

/**
 * `true` si hay que reescribir el nombre guardado en Medusa.
 *
 * La pregunta NO es "¿el ERP dice algo distinto de lo que tengo?" sino "¿lo
 * guardado ya es lo que yo escribiría?". La diferencia es la que hace que una
 * corrección editorial sobreviva: `Llanas, espátulas y fratachos` NO es igual
 * plegado a `LLANAS - ESPATULAS - FRATACHOS` —la puntuación no se pliega y sobra
 * una `y`—, así que comparar contra el crudo lo marcaría como rename y lo
 * revertiría en cada corrida del sync, cada quince minutos.
 *
 * Comparando contra el nombre normalizado quedan las tres respuestas correctas:
 * - lo guardado ya coincide con la salida del normalizador → no se toca;
 * - lo guardado difiere sólo en caso o tildes (una corrección a mano que el
 *   diccionario todavía no conoce) → gana la base, igual que antes;
 * - el ERP renombró de verdad → se propaga.
 */
export function categoryNameNeedsUpdate(stored: string, erpName: string): boolean {
  return !sameCategoryName(stored, normalizeCategoryName(erpName));
}
