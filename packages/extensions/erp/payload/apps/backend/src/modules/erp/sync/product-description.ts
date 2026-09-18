import {
  applyReadingCase,
  collapse,
  fold,
  titleRulesFingerprint,
  type TitleRules,
} from './product-title';

/**
 * Normalización de DESCRIPCIONES de artículo del ERP.
 *
 * `product-title.ts` existe porque Zeus manda el nombre del artículo como se
 * cargó en la gestión. Con la descripción pasa lo mismo y hasta ahora nadie la
 * miraba: `plan-product-updates.ts` copiaba `row.description` LITERAL, así que
 * el PDP de desdeelsur muestra hoy el volcado crudo de la gestión:
 *
 *     LATEX 3X MAS LAVABLE QUE LOS NORMALES. ES ADEMAS ANTIMARCA Y ANTIMANCHA.
 *     871  ESMALTE BRILLANTE
 *     AA - LIJA TELA ESMERIL N° 40
 *     14494 - ENDUIDO + MASILLA
 *
 * De los 2.717 productos de la tienda sólo 400 tienen descripción, y 363 de esas
 * son este texto. El barrido del 2026-09-01 las separa en tres naturalezas y no
 * en una:
 *
 *   163  contenido real, mal escrito         → se normaliza
 *   156  un código interno + dos palabras    → se descarta
 *    44  el título crudo del ERP repetido    → se descarta
 *
 * Por eso este módulo devuelve `null` en dos tercios de los casos: "normalizar"
 * un `871  ESMALTE BRILLANTE` a `Esmalte brillante` deja igual de sucio un PDP
 * cuyo título ya dice "Albalux diamante 3 en 1 aluminio x0,5 lt". El texto que
 * ese producto merece lo escribe el catalogador; lo que hace falta acá es que el
 * ERP deje de ocupar el lugar con ruido.
 *
 * Reglas:
 *
 *   D01  guardia de propiedad: un texto que NO está en mayúsculas sostenidas ya
 *        lo redactó alguien (el catalogador, una persona en el admin) y se
 *        devuelve intacto. Es la regla que hace que este módulo no pueda pisar
 *        contenido editorial, incluso si lo llamaran de más.
 *   D02  espacios colapsados
 *   D03  código interno de cabecera (`871  `, `14494 - `)
 *   D04  descarte: no queda texto, era sólo el código
 *   D05  descarte: repite el título del producto
 *   D06  descarte: fragmento de dos palabras o menos
 *   D07  caso de lectura y diccionario, con el MISMO criterio que R02/R10 del
 *        título (`applyReadingCase`), más la mayúscula de cada oración
 *
 * Subir `DESCRIPTION_RULES_VERSION` recalcula las descripciones que escribió el
 * sync —y sólo ésas— en la corrida siguiente.
 */
export const DESCRIPTION_RULES_VERSION = 1;

/**
 * Proporción de letras en mayúscula a partir de la cual el texto se considera
 * volcado crudo de la gestión (D01).
 *
 * 0,6 y no 1 porque el crudo real trae minúsculas sueltas: unidades pegadas
 * (`115mm - 750W`), un `x` de multiplicación, una marca escrita a mano. Y muy por
 * encima de lo que llega a tener un texto redactado, que aun con siglas y nombres
 * propios no pasa de ~0,15.
 */
const RAW_UPPERCASE_RATIO = 0.6;

/**
 * Acentuación y siglas que aparecen en las descripciones y NO en los títulos.
 *
 * Va aparte de `DEFAULT_TITLE_DICTIONARY` —y no sumado a él— porque el
 * diccionario del título entra en `titleRulesFingerprint`: agregarle una palabra
 * marca `rules_changed` en TODOS los productos de TODOS los tenants y dispara una
 * reescritura masiva de títulos. Una corrección de descripciones no tiene por qué
 * arrastrar eso.
 *
 * Son las palabras de prosa que el barrido encontró sin tilde. Las claves van
 * plegadas, igual que en el título, para que un término ya corregido vuelva a
 * matchear y mapee a sí mismo (idempotencia).
 */
export const DEFAULT_DESCRIPTION_DICTIONARY: Record<string, string> = {
  // Acentuación que la gestión no trae.
  mas: 'más',
  ademas: 'además',
  facil: 'fácil',
  rapido: 'rápido',
  rapida: 'rápida',
  presion: 'presión',
  construccion: 'construcción',
  concentracion: 'concentración',
  bonificacion: 'bonificación',
  regulacion: 'regulación',
  aplicacion: 'aplicación',
  solidos: 'sólidos',
  transito: 'tránsito',
  valvula: 'válvula',
  baterias: 'baterías',
  ecologico: 'ecológico',
  ecologica: 'ecológica',
  economico: 'económico',
  economica: 'económica',
  hibrido: 'híbrido',
  hibrida: 'híbrida',
  instantaneo: 'instantáneo',
  instantanea: 'instantánea',
  legitimo: 'legítimo',
  legitima: 'legítima',
  nautica: 'náutica',
  nautico: 'náutico',
  acetica: 'acética',
  simil: 'símil',
  zinguerias: 'zinguerías',
  elastico: 'elástico',
  elastica: 'elástica',
  ceramico: 'cerámico',
  ceramica: 'cerámica',
  ceramicos: 'cerámicos',
  ceramicas: 'cerámicas',
  extrusion: 'extrusión',
  maletin: 'maletín',
  regalias: 'regalías',
  // Erratas de la gestión. El diccionario es el lugar previsto para esto: son
  // una forma escrita mal y una forma canónica, igual que una tilde faltante.
  transparrente: 'transparente',
  permormance: 'performance',
  professional: 'profesional',
  // Siglas y unidades que quedan sueltas en la prosa.
  rpm: 'RPM',
  psi: 'PSI',
  ah: 'Ah',
  mp: 'MP',
  tp: 'TP',
  eq: 'EQ',
  nf: 'NF',
  '3m': '3M',
};

/**
 * Palabras que no cuentan para decidir si un texto "dice algo" (D05/D06). Son
 * las que aparecen en el crudo del ERP como conectores; sin sacarlas, un
 * `PARA RECORTES` contaría como dos palabras de contenido.
 */
const STOPWORDS = new Set([
  'al',
  'con',
  'de',
  'del',
  'el',
  'en',
  'es',
  'esta',
  'este',
  'la',
  'las',
  'lo',
  'los',
  'no',
  'para',
  'por',
  'que',
  'se',
  'sin',
  'sobre',
  'un',
  'una',
  'y',
  'o',
]);

/**
 * Código interno de cabecera: el número de artículo de la gestión, pegado
 * adelante del texto.
 *
 * Exige DOS espacios o un guion con espacios como separador, y eso no es
 * cosmético: es lo único que distingue `871  ESMALTE BRILLANTE` (código) de
 * `6000 RPM` o `70mm DE ANCHO` (contenido). Con un solo espacio como separador la
 * regla se comería la medida de la mitad del catálogo.
 */
const LEADING_CODE_RE = /^\d{2,}(?:\s{2,}|\s*-\s+)/;

/** Tokens con contenido: sin conectores, sin puntuación, de tres letras o más. */
function contentTokens(text: string): Set<string> {
  return new Set(
    fold(text)
      .split(/[^\p{L}\p{N}]+/u)
      .filter((token) => token.length > 2 && !STOPWORDS.has(token))
  );
}

/**
 * Mayúscula al empezar y después de cada punto, signo de exclamación o de
 * interrogación. El resto del casing ya lo resolvió `applyReadingCase`.
 */
function capitalizeSentences(text: string): string {
  // El `[^\p{L}]*` intermedio es para las oraciones que empiezan con algo que no
  // es una letra (`3M - cinta…`, `100% transparente`): la mayúscula va en la
  // primera LETRA, no en el primer carácter.
  //
  // Salvo que esa letra venga PEGADA a un número, que es una unidad y no el
  // comienzo de una palabra: `115mm - 750W` no es `115Mm - 750W`.
  return text.replace(
    /(^|[.!?]\s+)([^\p{L}]*)(\p{Ll})/gu,
    (match, prefix: string, lead: string, letter: string) =>
      /\d$/.test(lead) ? match : `${prefix}${lead}${letter.toUpperCase()}`
  );
}

/** ¿Es el volcado crudo de la gestión, o texto que redactó alguien? (D01) */
export function isRawErpDescription(text: string | null | undefined): boolean {
  const letters = [...(text ?? '')].filter((char) => /\p{L}/u.test(char));
  if (letters.length < 3) return true;
  const upper = letters.filter((char) => char === char.toUpperCase()).length;
  return upper / letters.length > RAW_UPPERCASE_RATIO;
}

/**
 * Colapsa espacios/tabs y whitespace lateral por línea, pero PRESERVA los
 * `\n\n` como separadores de bloque. Se usa cuando D01 detecta contenido
 * editorial (redactado por un catalogador o generado por `htmlToMarkdown` a
 * partir del HTML rico de un ERP con eCommerce). `collapse` los aplastaba a un
 * solo espacio y destruía Markdown válido.
 *
 * Para descripciones que llegan en una sola línea el resultado es idéntico al
 * de `collapse`, así que este helper es backwards-compatible con ERPs que no
 * mandan contenido multi-línea (Zeus, Contabilium, Bsale).
 */
function preserveBlockLayout(input: string): string {
  return input
    .split(/\n{2,}/)
    .map((block) => block.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').trim())
    .filter((block) => block.length > 0)
    .join('\n\n');
}

export type DescriptionDiscardReason = 'solo_codigo' | 'repite_el_titulo' | 'fragmento';

export type NormalizedDescription = {
  /** El texto para la tienda, o `null` cuando el crudo no aportaba nada. */
  description: string | null;
  /** Reglas que efectivamente cambiaron algo, para el log del sync. */
  applied: string[];
  /** Por qué se descartó, cuando `description` es `null` y había texto. */
  discarded: DescriptionDiscardReason | null;
};

/**
 * Huella de las reglas de descripción. Espeja `titleRulesFingerprint`: el sync la
 * guarda en la variante y compararla es lo que permite recalcular cuando alguien
 * toca el diccionario o sube la versión, sin volver a pedirle el catálogo al ERP.
 */
export function descriptionRulesFingerprint(rules: TitleRules): string {
  return `d${DESCRIPTION_RULES_VERSION}:${titleRulesFingerprint(rules)}`;
}

/**
 * Descripción del ERP → descripción de la tienda.
 *
 * `opts.title` es el título YA normalizado del producto: hace falta para D05, que
 * es la regla que saca los 44 casos en que la gestión copió el nombre del
 * artículo en el campo de descripción.
 */
export function normalizeProductDescription(
  raw: string | null | undefined,
  opts: { title?: string | null; rules: TitleRules }
): NormalizedDescription {
  const trimmed = (raw ?? '').trim();
  const original = collapse(trimmed);
  if (!original) return { description: null, applied: [], discarded: null };

  // D01. La guardia va primero y sin excepciones: si el texto no es el volcado
  // crudo, este módulo no tiene nada que opinar. Usamos `preserveBlockLayout`
  // en vez de `original` (que ya vino colapsado por `collapse`) para no
  // destruir estructura de bloques del contenido editorial —caso Markdown que
  // llega desde `htmlToMarkdown` en adapters con eCommerce integrado (Odoo).
  if (!isRawErpDescription(original)) {
    return { description: preserveBlockLayout(trimmed), applied: [], discarded: null };
  }

  const applied: string[] = [];

  // D03 ANTES de colapsar: el separador del código es justamente el espacio de
  // más (`871  ESMALTE`), así que aplicarla sobre el texto ya colapsado no
  // encuentra nada.
  const withoutCode = trimmed.replace(LEADING_CODE_RE, '');
  if (withoutCode !== trimmed) applied.push('D03');

  // D02.
  let working = collapse(withoutCode);
  if (working !== withoutCode) applied.push('D02');

  // D04.
  const tokens = contentTokens(working);
  if (!tokens.size) return { description: null, applied, discarded: 'solo_codigo' };

  // D05. El texto repite el título cuando casi todo lo que dice ya está en el
  // nombre del producto. No se compara al revés: un título largo con una
  // descripción que aporta dos datos nuevos sí sirve.
  const titleTokens = contentTokens(opts.title ?? '');
  if (titleTokens.size) {
    const shared = [...tokens].filter((token) => titleTokens.has(token)).length;
    if (shared / tokens.size >= 0.7) {
      return { description: null, applied, discarded: 'repite_el_titulo' };
    }
  }

  // D06. Dos palabras de contenido no son una descripción: son la categoría del
  // artículo, que el PDP ya muestra por su lado.
  if (tokens.size <= 2) return { description: null, applied, discarded: 'fragmento' };

  // D07.
  const cased = capitalizeSentences(
    applyReadingCase(working, {
      ...opts.rules,
      // Los defaults de descripción van DEBAJO: `rules.dictionary` ya trae los
      // del título más lo que el tenant configuró, y esa configuración manda.
      dictionary: { ...DEFAULT_DESCRIPTION_DICTIONARY, ...opts.rules.dictionary },
    })
  );
  if (cased !== working) applied.push('D07');

  return { description: cased, applied, discarded: null };
}
