import { NOT_A_BASE_LETTER, parseTintingBase } from '../tinting/parse-base';
import type { ErpTitleRulesSettings } from '../types';

/**
 * Normalización de TÍTULOS de artículo del ERP.
 *
 * Zeus devuelve la descripción del artículo como se cargó en la gestión:
 * mayúsculas sostenidas, la marca al inicio, separadores `-` y `|`, la
 * presentación pegada al final con abreviaturas inconsistentes (`LT`, `LTS`,
 * `LITROS`), medidas sin separar del número y leyendas o características entre
 * paréntesis:
 *
 *     VENIER - BARNIZ MARINO X 0,25 LTS
 *     MARBLE COLOR BASE T - MEDIANO | X25 KGS
 *     CUTTER PLASTICO 18MM (C118)
 *     ALBAVIAL AL SOLVENTE (TRADICIONAL) AMARILLO 4 LTS
 *
 * Ese texto se muestra tal cual en el PLP, el PDP y el buscador. Las reglas que
 * implementa este módulo lo pasan a formato de tienda:
 *
 *     Barniz marino x0,25 lt
 *     Marble color mediano x25 kg
 *     Cúter plástico C118 18 mm
 *     Albavial al solvente tradicional amarillo x4 lt
 *
 * Reglas implementadas (R01–R16 son la especificación funcional original; R17–R24
 * son la segunda tanda, acordada sobre el resultado del primer barrido; R25–R26
 * salieron del tintométrico y R27–R28 del barrido de textos de DESDEELSUR-34):
 *
 *   R01  marca al inicio → se quita si coincide con el atributo del ERP
 *   R02  caso de lectura: minúsculas + mayúscula inicial
 *   R03  presentación al final, `x` minúscula pegada a la cantidad (`x20 lt`);
 *        en la etiqueta de variante va SIN la `x` (`20 lt`)
 *   R04  unidades de volumen a una sola forma, en minúscula y de DOS letras
 *        (`LTS`/`LITROS` → `lt`, `ML` → `ml`, `CC` → `cc`)
 *   R05  unidades de peso ídem (`KGS` → `kg`, `GRS` → `gr`), sin convertir masa
 *        a volumen
 *   R06  coma decimal y sin ceros de relleno (`0.9` → `0,9`, `1,00` → `1`)
 *   R07  fracciones controladas a decimal (`1/2` → `0,5`)
 *   R08  espacios colapsados y punto final de sobra
 *   R09  leyendas comerciales entre paréntesis (lista aprobada)
 *   R10  diccionario controlado: tildes y siglas del rubro
 *   R11  letras técnicas de base: se reconoce `BASE F` (cualquier letra), las
 *        clases de dos letras (`BASE MF`) y la forma con la `x` del tamaño en
 *        medio (`BASE X P`). Lo que se hace con ellas lo decide R26
 *   R12  el color se DUPLICA en una opción de variante (ver `color-option.ts`)
 *   R13  nunca se infiere la marca
 *   R14  idempotencia
 *   R15  trazabilidad: reglas aplicadas y warnings por artículo
 *   R16  se eliminan `-` y `|`
 *   R17  número y unidad separados, unidad en minúscula, sin punto residual
 *        (`550W` → `550 W`, `15CM` → `15 cm`, `115 mm.` → `115 mm`)
 *   R18  medidas compuestas con `x` minúscula: `20 X 30 CM` → `20x30 cm`,
 *        `5MM X 100MM` → `5x100 mm`; con unidades distintas cada valor conserva
 *        la suya: `5M X 19MM` → `5 m x 19 mm`
 *   R19  paréntesis: la característica descriptiva se integra al título y el
 *        código técnico se conserva sin paréntesis; un dato con cantidad
 *        (`(2 m lineales)`, `(8 per)`) conserva los paréntesis
 *   R20  la `/` se conserva cuando es abreviatura o código (`p/interior`,
 *        `920/2`) y se elimina cuando separa dos palabras; la palabra que sigue a
 *        la abreviatura sí pasa por el diccionario (`c/iman` → `c/imán`)
 *   R21  numeraciones a una sola forma: `N16`, `Nº7`, `nº 50` → `N.º 16`,
 *        `N.º 7`, `N.º 50`, sin ceros a la izquierda (`N.º 07` → `N.º 7`)
 *   R22  expresiones comerciales: `3EN1` → `3 en 1`, `Set 3` → `Set de 3`
 *   R23  `ML` como metros lineales cuando el artículo es un perfil que se vende
 *        por metro (`MOLDURA … (2ML)` → `Moldura … (2 m lineales)`)
 *   R24  pulgadas con el símbolo pegado al número (`9 pulgadas` → `9"`), y una
 *        lista de medidas entre paréntesis lo lleva en cada valor
 *        (`(1,5 3 y 6)` → `1,5", 3" y 6"`)
 *   R27  el código interno del artículo se descarta en lugar de integrarse
 *        (`(337475)` → nada), y los paréntesis que la gestión manda pegados o
 *        sin cerrar se reparan antes de todo lo demás
 *   R28  la `x` de una dimensión sin unidad va en minúscula (`100X610` →
 *        `100x610`); con unidad ya lo hace R18
 *   R25  los litros de una BASE ENTONABLE se llevan al envase que se vende
 *        (`BASE F X 3,6 LTS` → `Base F x4 lt`): el ERP carga el contenido de
 *        base y el resto del envase lo llena el entonado. Por defecto es el
 *        entero de arriba, así que `0,9` y `3,6` son el litro y los 4 de la
 *        góndola; los contenidos GRANDES son la excepción y los declara
 *        `TINT_BASE_CAN_LITERS`: `8,7` son 10 y `17,4` son 20, no 9 y 18
 *        (DESDEELSUR-23 y DESDEELSUR-27). Sólo para bases y sólo en litros — un
 *        barniz de `0,25 lt` es un cuarto litro de verdad
 *   R26  la base NO se nombra en el título: `BASE F X 3,6 LTS` → `x4 lt`, sin el
 *        `Base F`. Es un dato técnico del tintométrico (qué cantidad de blanco
 *        trae el envase para poder entonarlo), no algo que el comprador elija:
 *        en la tienda se elige el COLOR y la base sale sola. Dejarlo en la card
 *        llenaba el listado de "Base F" / "Base P" repetidos al lado de nombres
 *        por lo demás idénticos. Se quita la letra Y el token `base` que la
 *        introduce, y también el `base` SUELTO de las líneas de base única
 *        (`… MARMOL BASE X 3,24 LTS` → `… marmol x4 lt`), que sólo se reconoce
 *        como tal si viene pegado a la presentación. El `base` sustantivo común
 *        ("sin base", "solo base", "base al agua", "masilla base" sin envase) se
 *        conserva, porque ahí forma parte del nombre del producto
 *
 * Es hermano de `category-name.ts` y comparte su decisión de fondo: **el caso lo
 * arregla el código, la ortografía la arregla un diccionario**. Las tildes no se
 * infieren — no hay forma de saber que "METALICO" lleva tilde sin una entrada —
 * así que "látex", "cúter" o "Dr. Ox." salen de una tabla controlada, ampliable
 * desde la configuración y sin inferencias libres (R10).
 *
 * Dos casos de la lista de aceptación salen distinto A PROPÓSITO, porque la regla
 * general acordada dice lo contrario que el ejemplo suelto:
 *
 *  - `… 127 mm (8 per) N.º 120`: el ejemplo abría los paréntesis con comas, pero
 *    R19 pide conservarlos cuando el paréntesis trae una cantidad, igual que
 *    `(2 m lineales)`. Se conservan.
 *  - `… altura 7 cm x 2,5 m de largo`: el ejemplo pegaba la `x` a la segunda
 *    medida, pero R18 dice que entre dos medidas de unidad distinta la `x` va
 *    separada. Va separada.
 *
 * La función es PURA e IDEMPOTENTE: `normalize(normalize(x)) === normalize(x)`.
 * De eso depende toda la política de reescritura del sync (ver
 * `plan-product-updates.ts`): un título ya normalizado que vuelve a pasar por
 * acá sale idéntico, así que el sync no tiene nada que escribir y no hay churn
 * de updates ni de reindexado.
 */

/**
 * Versión de las reglas implementadas en código. Subirla fuerza a re-normalizar
 * todo el catálogo en el próximo barrido (la huella cambia). Se sube cuando un
 * cambio acá altera la salida de títulos que ya estaban normalizados.
 *
 * v2: `stripBrandPrefix` pasa a quitar el prefijo más largo en lugar de exigir
 * todos los tokens de la marca. Sin este bump, los títulos que ya decían
 * "Venier Dr. Ox. …" o "Rust oleum acabado …" nunca se corregirían: la política
 * de reescritura no los toca si la huella no cambió.
 *
 * v3: segunda tanda de reglas (R17–R24) sobre lo que se vio en el primer
 * barrido, más el cambio de canon de las unidades a minúscula (`x4 L` → `x4 l`,
 * `x25 Kg` → `x25 kg`) y la `x` de presentación siempre presente. Toca la salida
 * de PRÁCTICAMENTE TODO el catálogo ya normalizado, así que el bump es lo que
 * hace que la corrida siguiente lo corrija solo.
 *
 * v4: las unidades de presentación pasan a DOS letras (`x4 l` → `x4 lt`, `500 g`
 * → `500 gr`), los litros de las bases entonables se redondean al envase real
 * (R25: `x3,6 lt` → `x4 lt`) y R11 deja de leer como letra de base la `x` que va
 * antes de ella (`Base X p` → `Base P`). Toca todo el catálogo con presentación en
 * litros o gramos, así que otra vez el bump es lo que hace que se corrija solo.
 *
 * v5: R11 pasa a mayúscula las CLASES de base de dos letras (`base mf` → `Base
 * MF`). Son 4 artículos, pero sin el bump ninguno se corrige: la política de
 * reescritura no los toca si la huella no cambió.
 *
 * v6: R26 saca la base del título (`Base F x4 lt` → `x4 lt`, y el `base` suelto de
 * las líneas de base única). Toca los ~151 artículos con letra más los de base
 * única que ya estaban normalizados, y sin el bump ninguno se corregiría: son
 * justamente los que la política de reescritura no vuelve a mirar porque su
 * huella coincide.
 *
 * v7: R25 deja de redondear `17,4` al entero de arriba: el cliente vende esa base
 * como el balde de 20 litros, no de 18 (DESDEELSUR-23). Son ~29 bases que hoy
 * dicen `x18 lt`, entre las que entraron por la ruta de bases y las que vinieron
 * por el catalog sync. Sin el bump ninguna se corrige: son justamente las que la
 * política de reescritura no vuelve a mirar porque su huella coincide. `8,7 → 9`
 * NO cambia en este bump — la deuda que anotó se paga en v10.
 *
 * v8: entran las bases de AIKE, que el detector no veía porque el ERP las carga
 * como `COLOR <letra> (<grupo>)` y no como `BASE <letra>` (ver `parse-base.ts`).
 * Son 18 artículos de dos líneas —Látex I+E y Esmalte 2 en 1— y lo que el bump
 * les corrige es el ENVASE (R25): `TINT_BASE_CAN_LITERS` suma `9 → 10` y
 * `18 → 20`, porque AIKE carga contenido de base igual que Alba y su escalera es
 * 0,9 / 3,6 / 9 / 18 contra los baldes de 1 / 4 / 10 / 20 que vende el mercado —
 * el `ceil` acierta los dos primeros y falla los dos últimos. `8,7 → 9` sigue sin
 * cambiar en este bump, pero la escalera de AIKE es la evidencia independiente
 * que terminó cerrando la deuda en v10: dos fabricantes con la misma escalera.
 *
 * DEUDA VISIBLE, fuera del alcance de este bump: R26 NO les saca la letra de
 * base, porque busca la palabra `Base` que escribe el normalizador y estos dicen
 * `color f b` —texto que viene crudo de Zeus—. Así que quedan como
 * "Aike látex i+e color f b x20 lt" y no "Aike látex i+e x20 lt". Sacarlo es otra
 * regla y además una decisión: colapsaría las tres letras (F/P/T) de cada litraje
 * a un único título, igual que ya pasa con las Albacryl.
 *
 * v9: R27 y R28, las dos del barrido de DESDEELSUR-34.
 *
 * R27 saca el código interno del artículo, que hasta ahora R19 ABRÍA en lugar de
 * descartar: 236 títulos terminaban en un número suelto de seis dígitos
 * (`2X Ultra Cover azul oasis satinado 337475`). La condición pide dígitos
 * puros, cinco o más, Y que aparezcan en `zeus_codigo_fabrica` — las tres a la
 * vez, para que `(C118)` siga saliendo `Cúter plástico C118 18 mm` y los modelos
 * de cuatro dígitos de Skil (`1831`, `5402`, `7640`) no se pierdan. También
 * repara los paréntesis que la gestión manda pegados o sin cerrar, que era lo
 * que dejaba `Candado titanium 25 mm(3 LLAVES)COD.6070` gritando en el medio de
 * una frase en minúscula.
 *
 * R28 pasa a minúscula la `x` de una dimensión sin unidad (`100X610` → `100x610`):
 * R18 necesita anclarse en la unidad y sin ella `lowercaseWords` trata al token
 * como un código. Son 21 títulos.
 *
 * R04 suma `ctms` / `cmts` / `ctm`, que es la forma en que la gestión escribe
 * centímetros DE VERDAD —con la `t` y la `m` al revés—: 54 títulos salían
 * `Rodillo lana cubretodo x22 ctms` porque la unidad no estaba en el mapa.
 *
 * Y R18 gana un lookbehind, que salió de reconocer esa unidad: con `cmts`
 * reconocida, `T40 X 11 CMTS` empezaba a matchear como medida compuesta y salía
 * `T40x11 cm`, que se lee como una dimensión de 40 × 11. Arregla además cuatro
 * destornilladores que ya estaban mal (`DHC1x80 mm` era el modelo pegado a la
 * medida).
 *
 * Este bump reescribe 326 de los 2616 títulos de desdeelsur. Los otros 2290
 * salen idénticos, así que la política de reescritura no los toca.
 *
 * v10: R25 paga la deuda de `8,7`. El cliente confirmó lo que la nota de v7
 * dejaba abierto: esa base es el balde de 10 litros, no el de 9 (DESDEELSUR-27).
 * Alcanza a las bases de 8,7 de Albacryl, Albalatex mate, Duralba látex exterior
 * y Duralba frentes —las mismas líneas cuyo producto BLANCO ya se vendía en 1, 4,
 * 10 y 20—, más Albalatex ultralavable, AlbaExpert y Design Mate, que son las que
 * nombra el ticket. Con esto la escalera de R25 queda completa y coherente en
 * los dos fabricantes: 0,9 → 1, 3,6 → 4, 8,7 → 10, 17,4 → 20 en Alba, y
 * 0,9 → 1, 3,6 → 4, 9 → 10, 18 → 20 en AIKE.
 *
 * Sin el bump ninguna se corrige: son justamente las que la política de
 * reescritura no vuelve a mirar porque su huella coincide. Y como el chip de
 * `Presentación` ya escrito dice `9 lt`, la pisada la habilita
 * `supersededPresentationLabels`, que deriva la etiqueta superada de esta misma
 * tabla y por lo tanto no necesita ningún cambio.
 */
export const TITLE_RULES_VERSION = 10;

/** Reglas efectivas: defaults de código + overrides de la configuración. */
export type TitleRules = {
  /** Clave PLEGADA (sin tildes ni caso) → forma canónica a escribir. */
  dictionary: Record<string, string>;
  /** Leyendas comerciales aprobadas, PLEGADAS. Se quitan solo entre paréntesis. */
  promoLegends: string[];
  /** Quitar la marca del inicio cuando coincide con el atributo estructurado. */
  stripBrand: boolean;
};

export type NormalizedTitle = {
  /** Título listo para escribir en Medusa. `null` si el ERP no mandó nada. */
  title: string | null;
  /**
   * Presentación normalizada suelta, sin la `x` (`0,25 l`, `25 kg`). `null` si el
   * título no traía una. Se guarda en la metadata de la variante; la agrupación
   * de variantes por presentación queda fuera de alcance (R11).
   */
  presentation: string | null;
  /** IDs de las reglas que efectivamente cambiaron algo, para el log (R15). */
  applied: string[];
  /** Unidad desconocida, fracción no soportada: se procesa igual con warning (R15). */
  warnings: string[];
};

/**
 * Diccionario controlado por default. Sale de lo que la especificación nombra
 * explícitamente: nombres propios y líneas comerciales que conservan su formato
 * (R10/R11) y los términos del rubro a los que el ERP les come la tilde.
 *
 * Las claves van PLEGADAS (minúsculas, sin tildes) porque el matcheo se hace
 * sobre la forma plegada del título: eso hace que un término YA corregido
 * ("metálico") vuelva a matchear y mapee a sí mismo, que es lo que sostiene la
 * idempotencia.
 *
 * Las letras de base tintométrica NO están acá: las resuelve una regla general
 * (`applyBaseLetters`), que cubre cualquier letra y no una lista cerrada.
 */
export const DEFAULT_TITLE_DICTIONARY: Record<string, string> = {
  // Líneas comerciales y nombres propios (conservan mayúsculas).
  'dr. ox.': 'Dr. Ox.',
  'dr ox': 'Dr. Ox.',
  'ultra cover': 'Ultra Cover',
  paris: 'Paris',
  // Acentuación que el ERP no trae (R10).
  latex: 'látex',
  metalico: 'metálico',
  metalica: 'metálica',
  metalizado: 'metalizado',
  ignifugo: 'ignífugo',
  ignifuga: 'ignífuga',
  acrilico: 'acrílico',
  acrilica: 'acrílica',
  sintetico: 'sintético',
  sintetica: 'sintética',
  poliuretanico: 'poliuretánico',
  poliuretanica: 'poliuretánica',
  plastico: 'plástico',
  plastica: 'plástica',
  antioxido: 'antióxido',
  oxido: 'óxido',
  aluminio: 'aluminio',
  interior: 'interior',
  cesped: 'césped',
  album: 'álbum',
  vinilico: 'vinílico',
  vinilica: 'vinílica',
  liquido: 'líquido',
  liquida: 'líquida',
  zocalo: 'zócalo',
  zocalos: 'zócalos',
  metrico: 'métrico',
  metrica: 'métrica',
  cuter: 'cúter',
  cutter: 'cúter',
  aerografo: 'aerógrafo',
  lapiz: 'lápiz',
  escalon: 'escalón',
  marron: 'marrón',
  espatula: 'espátula',
  espatulas: 'espátulas',
  plasticas: 'plásticas',
  plasticos: 'plásticos',
  iman: 'imán',
  // Siglas y códigos del rubro (R09/R10).
  pvc: 'PVC',
  pva: 'PVA',
  mdf: 'MDF',
  abs: 'ABS',
  led: 'LED',
  uv: 'UV',
  wc: 'WC',
  bt: 'BT',
  bo: 'BO',
  sp: 'SP',
  pak: 'PAK',
  aa: 'AA',
  // Símbolos de unidad que quedan sueltos en el título (`550 W`), y el número de
  // grano, que se escribe con la forma del ordinal (R21).
  w: 'W',
  v: 'V',
  hp: 'HP',
  'n.º': 'N.º',
};

/**
 * Leyendas comerciales aprobadas (R09). Solo se remueven cuando están ENTRE
 * PARÉNTESIS: un paréntesis con contenido que no esté en esta lista NO se
 * descarta, se integra al título o conserva los paréntesis según R19.
 */
export const DEFAULT_PROMO_LEGENDS: string[] = [
  'super oferta',
  'oferta',
  'oferta especial',
  'promo',
  'promocion',
  'en promocion',
  'liquidacion',
  'descuento',
  'nuevo',
  '2x1',
];

/**
 * Unidades del ERP → forma canónica de la tienda (R04/R05/R17). El valor es lo
 * que se escribe EXACTAMENTE: todas en minúscula salvo los símbolos eléctricos,
 * que son símbolos y no abreviaturas (`W`, `V`, `HP`).
 *
 * Las de PRESENTACIÓN son todas de dos letras (`lt`, `ml`, `cc`, `kg`, `gr`) y no
 * el símbolo del SI (`l`, `g`): son las que se leen sueltas en la card y en el
 * chip de la variante, donde una sola letra al lado de un número no se lee como
 * unidad —`4 l` parece un tipeo y `500 g` se confunde con el gramaje del envase—.
 * Las de longitud siguen el símbolo (`m`, `cm`, `mm`) porque siempre van con su
 * contexto adentro del nombre.
 *
 * `cc` se conserva como `cc` a propósito: son 323 artículos del catálogo y
 * convertir centímetros cúbicos a mililitros cambiaría el significado comercial
 * de la etiqueta (R05: no convertir masa a volumen ni viceversa).
 *
 * Las claves están en la forma que devuelve `unitKey` (plegada, sin puntos, con
 * `³` pasado a `3`), así que `CM3`, `cm³` y `C.C.` caen todas en `cc`.
 */
const UNITS: Record<string, string> = {
  // Volumen.
  l: 'lt',
  lt: 'lt',
  lts: 'lt',
  litro: 'lt',
  litros: 'lt',
  ml: 'ml',
  mls: 'ml',
  mililitro: 'ml',
  mililitros: 'ml',
  cc: 'cc',
  cm3: 'cc',
  // Peso.
  kg: 'kg',
  kgs: 'kg',
  kgr: 'kg',
  kgrs: 'kg',
  kilo: 'kg',
  kilos: 'kg',
  g: 'gr',
  gr: 'gr',
  grs: 'gr',
  gramo: 'gr',
  gramos: 'gr',
  // Longitud.
  mm: 'mm',
  mms: 'mm',
  milimetro: 'mm',
  milimetros: 'mm',
  cm: 'cm',
  cms: 'cm',
  centimetro: 'cm',
  centimetros: 'cm',
  // La forma que la gestión escribe DE VERDAD para centímetros, con la `t` y la
  // `m` al revés. Son 55 títulos de desdeelsur —rodillos, mini rodillos,
  // fieltros, vendas— que salían `Rodillo lana cubretodo x22 ctms` porque `ctms`
  // no estaba acá y R04 no la reconocía como unidad. `ctm` en singular aparece
  // en un artículo que se vende por centímetro.
  ctms: 'cm',
  cmts: 'cm',
  ctm: 'cm',
  m: 'm',
  mt: 'm',
  mts: 'm',
  metro: 'm',
  metros: 'm',
  // Eléctricas: símbolos, en mayúscula.
  w: 'W',
  v: 'V',
  hp: 'HP',
};

/**
 * Unidades que expresan la PRESENTACIÓN comercial (capacidad o peso). Son las
 * únicas que se separan del nombre, se mueven al final y llevan la `x` (R03).
 *
 * Las de longitud no: en "AA disco pulir 115 mm" o "cinta 5 m x 19 mm" la medida
 * describe al producto y "x115 mm" leería como si se vendiera por milímetro.
 */
const PRESENTATION_UNITS = new Set(['lt', 'ml', 'cc', 'kg', 'gr']);

/**
 * La unidad en la que se redondea el envase de una base entonable (R25). Sólo
 * litros: `CC` es un envase chico donde el hueco del entonado no llega ni a un
 * litro, y `KG`/`GR` son masa (el hueco no se puede despejar sin densidad).
 */
const TINT_BASE_ROUNDING_UNIT = 'lt';

/**
 * Envases de base cuyo litraje comercial NO es el entero de arriba (R25).
 *
 * El redondeo por defecto es `Math.ceil`, que acierta `0,9 → 1` y `3,6 → 4`. Los
 * contenidos grandes NO: el cliente vende la base de `8,7` como el balde de 10 y
 * la de `17,4` como el de 20, no como 9 y 18 (DESDEELSUR-23 y DESDEELSUR-27). Va
 * como tabla de excepciones y no como escalera de envases porque es una
 * definición COMERCIAL por capacidad, no una regla que se pueda derivar del
 * número.
 *
 * Las cuatro entradas son DOS escaleras del mismo mercado, una por fabricante:
 *
 * | fabricante | contenido de base | envase que se vende |
 * | --- | --- | --- |
 * | Alba | 0,9 / 3,6 / 8,7 / 17,4 | 1 / 4 / **10** / **20** |
 * | AIKE | 0,9 / 3,6 / 9 / 18 | 1 / 4 / **10** / **20** |
 *
 * El `ceil` acierta los dos primeros peldaños de las dos y falla los dos últimos,
 * y por eso las cuatro excepciones son de contenido grande. Que dos fabricantes
 * independientes vendan los mismos cuatro baldes es lo que confirmó que `8,7 → 9`
 * era un error y no una presentación real (el producto BLANCO —no entonable— de
 * todas las líneas con bases de 8,7 ya se vendía en 1, 4, 10 y 20, nunca en 9).
 *
 * Sólo alcanza a BASES ENTONABLES, así que un balde de 18 litros de verdad no se
 * toca: el adhesivo de contacto de FORTEX, la pintura asfáltica de MEGAFLEX y el
 * aceite de lino de VITECSO se venden en 18 y siguen diciendo `x18 lt`. Por el
 * mismo motivo un producto terminado de 9 lt tampoco pasa a 10: el guard es
 * `isTintableBaseTitle`, no la capacidad.
 *
 * La comparación es con tolerancia y no por igualdad: el litraje llega como texto
 * del ERP (`17,4`) y pasa por `Number`, así que atarlo a un float exacto sería
 * frágil ante un `17,40`.
 */
const TINT_BASE_CAN_LITERS: ReadonlyArray<readonly [number, number]> = [
  [8.7, 10],
  [9, 10],
  [17.4, 20],
  [18, 20],
];

/** Unidades de longitud: las únicas que forman medidas compuestas (R18). */
const DIMENSION_UNITS = new Set(['mm', 'cm', 'm']);

/**
 * Formas que PARECEN una medida pero son una marca. `3M` es la única del rubro
 * (lijas, cintas, abrasivos) y sin esta excepción "LIJA 3M" saldría "Lija 3 m".
 *
 * Solo protege la forma pegada: "3 M" con espacio ya se resuelve igual por otro
 * camino (el token `M` suelto pasa a minúscula en R02), y dentro de una medida
 * compuesta ("3M X 19MM") gana la lectura de medida, que es lo que pide R18.
 */
const BRAND_LIKE_MEASURES = new Set(['3m']);

/**
 * Fracciones que se convierten a decimal (R07). Es una lista CONTROLADA: `1/2` es
 * la única que aparece en el catálogo relevado, y cualquier otra queda como vino
 * con un warning en lugar de inventar una conversión.
 */
const FRACTIONS: Record<string, string> = {
  '1/2': '0,5',
};

export const collapse = (input: string): string => input.trim().replace(/\s+/g, ' ');

/** Sin tildes, sin caso, sin espacios de más: la forma que se compara. */
export function fold(input: string): string {
  return collapse(input)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** Forma con la que se busca una unidad en `UNITS`: `LTS.` → `lts`, `cm³` → `cm3`. */
const unitKey = (raw: string): string => fold(raw).replace(/³/g, '3').replace(/\./g, '');

/**
 * Alternativa de regex con todas las formas de unidad. Ordenada de más larga a
 * más corta para que `mts` gane sobre `mt` y `cm3` sobre `cm`; incluye las dos
 * grafías que el ERP escribe con puntos o superíndice y que `unitKey` después
 * pliega a la misma clave.
 */
const UNIT_SOURCE = `(?:${[...Object.keys(UNITS), 'c\\.c', 'cm³']
  .sort((left, right) => right.length - left.length)
  .join('|')})`;

/** Lo que puede venir después de una unidad sin que deje de serlo. */
const UNIT_END = '(?![\\p{L}\\d³])';

/** Un número decimal o una fracción, como los escribe el ERP. */
const NUMBER_SOURCE = '\\d+(?:[.,]\\d+)?|\\d+\\/\\d+';

/** `18MM`, `0,25 LTS.`, `1/2 LT`: cantidad + unidad, en cualquier parte del título. */
const MEASURE_RE = new RegExp(`(${NUMBER_SOURCE})\\s*(${UNIT_SOURCE})\\.?${UNIT_END}`, 'giu');

/**
 * Medida compuesta: `20 X 30 CM`, `5 MM X 100 MM`, `5M X 19MM` (R18).
 *
 * El lookbehind pide que el primer número NO venga pegado a una letra, porque ahí
 * no es una medida: es un modelo. `MINI RODILLO ROLLER (EPOXI) T40 X 11 CMTS` es
 * un rodillo T40 de 11 cm, y sin esto sale `T40x11 cm`, que se lee como una
 * dimensión de 40 × 11.
 *
 * También bloquea el dígito, y no es defensivo: sin él el regex arranca EN MEDIO
 * del número (`T4` + `0 X 11 cm`) y el resultado es el mismo `T40x11 cm` por otro
 * camino.
 */
const COMPOUND_RE = new RegExp(
  `(?<![\\p{L}\\d])(\\d+(?:[.,]\\d+)?)\\s*(${UNIT_SOURCE})?\\s*[xX]\\s*(\\d+(?:[.,]\\d+)?)\\s*(${UNIT_SOURCE})${UNIT_END}`,
  'giu'
);

/**
 * `x` de presentación: se pega a la cantidad (R03). El grupo opcional del
 * principio es la excepción: una `x` que viene DESPUÉS de una medida de longitud
 * es el separador de una medida compuesta y conserva sus espacios (R18).
 */
const GLUE_RE = new RegExp(
  `(\\d+(?:[.,]\\d+)?\\s(?:mm|cm|m)${UNIT_END}\\s+)?\\b[xX]\\s*(?=\\d)`,
  'gu'
);

/** Presentación al final del título, con o sin `x`. */
const TRAILING_MEASURE_RE = new RegExp(
  `(?:\\b([xX])\\s*)?(${NUMBER_SOURCE})\\s*(${UNIT_SOURCE})\\.?${UNIT_END}\\s*$`,
  'u'
);

/** `X 5 ESC`: hay presentación pero la unidad no está en el mapa (R15). */
const UNKNOWN_PRESENTATION_RE = /\b[xX]\s*\d+(?:[.,]\d+)?\s*(\p{L}{1,12})\.?\s*$/u;

/**
 * Numeración de pincel, rodillo, disco o grano: `N16`, `Nº7`, `nº 11`, `n° 120`,
 * `NRO 3` → `N.º 16` (R21).
 *
 * La `n` tiene que ser un token propio: no matchea la de "EN 1" ni la de
 * "PIN 16" porque ahí viene pegada a otra letra.
 *
 * El límite se escribe con lookbehind y no con `\b` porque `\b` de JavaScript
 * usa `[A-Za-z0-9_]` aun con el flag `u`: una vocal acentuada NO es carácter de
 * palabra, así que `\bn` matcheaba la `n` final de "marró|n" y
 * `Fieltro marrón 50 mm` salía `Fieltro marrón.º 50 mm`. Era uno de los tres
 * títulos del catálogo que rompían la idempotencia.
 */
const NUMBERING_RE = /(?<![\p{L}\p{N}])n(?:ro|\.?[º°])?\.?\s*(\d+)(?![\p{L}\p{N}])/giu;

/** `3EN1`, `3 EN1`, `3EN 1` → `3 en 1` (R22). */
const THREE_IN_ONE_RE = /(\d)\s*en\s*(\d)/giu;

/** `SET 3` → `Set de 3` (R22). */
const SET_OF_RE = /\bset\s+(?=\d)/giu;

/**
 * Medidas en pulgadas: el símbolo va PEGADO al número y reemplaza a la palabra
 * (R24). Se aceptan las grafías que usa el ERP, incluida la comilla ya escrita,
 * para que la regla sea idempotente.
 */
const INCH_RE =
  /(?:(\d+)\s+)?(\d+(?:[.,]\d+)?|\d+\/\d+)\s*(?:pulgadas|pulgada|pulg\.?|''|″|”|")/giu;

/**
 * Contenido de paréntesis que es SOLO una lista de números (`1,5 3 y 6`): son
 * medidas en pulgadas de un juego, y el símbolo va en cada valor (R24).
 *
 * El separador es OBLIGATORIO: si fuera opcional, un código numérico de un solo
 * token ("252156") matchearía partiéndose al medio y saldría como dos medidas.
 */
const NUMBER_LIST_RE = /^\d+(?:[.,]\d+)?(?:(?:\s*,\s*|\s+y\s+|\s+)\d+(?:[.,]\d+)?)+$/iu;

/**
 * `/` entre dos palabras: es separador y se elimina. Con una sola letra a la
 * izquierda (`p/interior`, `c/ repuestos`) o con dígitos (`920/2`, `16/1`) es
 * abreviatura o código y se conserva (R20).
 */
const SLASH_SEPARATOR_RE = /(?<=\p{L}\p{L})\/(?=\p{L}\p{L})/gu;

/** Un paréntesis, sin anidar (el ERP no los anida). */
const PAREN_RE = /\(([^()]*)\)/g;

/**
 * Paréntesis PRECEDIDO por una medida. El contenido pertenece al nombre y la
 * medida es especificación, así que al abrirlo el contenido va ANTES de la
 * medida: `115 mm (chicos) N.º 50` → `chicos 115 mm N.º 50` (R19).
 */
const PAREN_AFTER_MEASURE_RE = new RegExp(
  `((?:\\b[xX]\\s*)?\\d+(?:[.,]\\d+)?\\s${UNIT_SOURCE}${UNIT_END})\\s+\\(([^()]*)\\)`,
  'giu'
);

/**
 * Perfiles que se venden por metro: en estos artículos `ML` es METROS LINEALES y
 * no mililitros (R23). Lista CERRADA a propósito — sin contexto `ML` son
 * mililitros, y de eso dependen cientos de artículos de pinturería.
 */
const LINEAR_METER_TERMS = new Set(
  [
    'moldura',
    'molduras',
    'varilla',
    'varillas',
    'perfil',
    'perfiles',
    'zocalo',
    'zocalos',
    'guardasilla',
    'guardasillas',
    'junquillo',
    'junquillos',
    'tapajunta',
    'tapajuntas',
    'cornisa',
    'cornisas',
    'liston',
    'listones',
  ].map((term) => fold(term))
);

/** Palabras que hacen de `base` un sustantivo común y no una letra técnica (R11). */
const BASE_AS_NOUN = new Set(['sin', 'solo', 'con', 'incluye', 's/', 'c/']);

/**
 * Tokens que nunca son la letra de una base (R11):
 *
 *  - las conjunciones de una letra y la `x`, que es el "por" del tamaño
 *    ("BASE X 3,24 LTS" es una base ÚNICA);
 *  - las palabras de DOS letras del castellano que caen justo detrás de "base"
 *    ("a base DE almendras", "base AL agua"). Esa lista se comparte con el
 *    detector del tintométrico y está medida contra el catálogo real, así que las
 *    dos superficies deciden igual.
 */
const NOT_BASE_LETTERS = new Set([
  'y',
  'o',
  'e',
  'u',
  'x',
  ...[...NOT_A_BASE_LETTER].map((token) => token.toLowerCase()),
]);

/**
 * Letra o CLASE de base (R11): una letra suelta (`F`, `P`, `T`) o una clase de dos
 * (`MF`, 4 artículos del catálogo relevado). Tres ya es una palabra.
 *
 * Las de dos hacían falta: el detector del tintométrico las reconoce desde el
 * principio (`[A-Z]{2}` en `LEADING_LETTER`) pero R11 sólo veía las de UNA, así
 * que las 4 bases MF del catálogo se quedaban con la letra en el título mientras
 * sus hermanas F y T ya la habían perdido.
 */
const isBaseLetter = (token: string | undefined): boolean =>
  typeof token === 'string' && /^\p{L}{1,2}$/u.test(token) && !NOT_BASE_LETTERS.has(fold(token));

/** Mezcla los overrides de la configuración sobre los defaults de código. */
export function resolveTitleRules(overrides?: ErpTitleRulesSettings | null): TitleRules {
  const dictionary = { ...DEFAULT_TITLE_DICTIONARY };
  for (const [key, value] of Object.entries(overrides?.dictionary ?? {})) {
    const folded = fold(key);
    if (!folded) continue;
    // Un valor vacío BORRA la entrada default: es la única forma de desactivar
    // un término del diccionario base desde la UI.
    if (!value.trim()) delete dictionary[folded];
    else dictionary[folded] = collapse(value);
  }

  const promoLegends = new Set(DEFAULT_PROMO_LEGENDS);
  for (const legend of overrides?.promo_legends ?? []) {
    const folded = fold(legend);
    if (folded) promoLegends.add(folded);
  }

  return {
    dictionary,
    promoLegends: [...promoLegends],
    stripBrand: overrides?.strip_brand ?? true,
  };
}

/**
 * Huella de las reglas EFECTIVAS, con forma `3:a3f9c1d2`.
 *
 * Se guarda junto al título normalizado. Cambia si sube `TITLE_RULES_VERSION` o
 * si alguien edita el diccionario / las leyendas desde la configuración, y eso
 * es lo que hace que el barrido siguiente re-normalice el catálogo sin que nadie
 * tenga que forzar nada a mano.
 *
 * FNV-1a en lugar de `node:crypto` para que el módulo quede sin imports de
 * runtime: no es un hash criptográfico, solo un detector de cambios.
 */
export function titleRulesFingerprint(rules: TitleRules): string {
  const canonical = JSON.stringify({
    v: TITLE_RULES_VERSION,
    d: Object.keys(rules.dictionary)
      .sort()
      .map((key) => [key, rules.dictionary[key]]),
    p: [...rules.promoLegends].sort(),
    b: rules.stripBrand,
  });

  let hash = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i += 1) {
    hash ^= canonical.charCodeAt(i);
    // Multiplicación FNV por 16777619 en aritmética de 32 bits sin desbordar.
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${TITLE_RULES_VERSION}:${hash.toString(16).padStart(8, '0')}`;
}

/** Resultado de un paso de normalización: texto nuevo y qué reglas lo cambiaron. */
type Pass = { text: string; rules: string[]; warnings: string[] };

const pass = (text: string, rules: string[] = [], warnings: string[] = []): Pass => ({
  text,
  rules,
  warnings,
});

/** Quita las leyendas promocionales aprobadas que estén entre paréntesis (R09). */
function stripPromoLegends(title: string, legends: string[]): Pass {
  let hit = false;
  const out = title.replace(PAREN_RE, (match, inner: string) => {
    if (!legends.includes(fold(inner))) return match;
    hit = true;
    return ' ';
  });
  return pass(collapse(out), hit ? ['R09'] : []);
}

/**
 * Quita la marca del inicio SOLO si los primeros tokens del título coinciden con
 * el atributo estructurado (R01). Sin marca informada, o con una marca que no
 * matchea, no se quita ninguna palabra: 1.902 de 2.660 artículos llegan sin
 * marca y adivinarla borraría parte del nombre real (R13).
 *
 * Se quita el PREFIJO MÁS LARGO que coincida, no la marca completa. Exigir que
 * coincidieran todos los tokens dejaba la marca en el título justo donde el
 * atributo trae la línea pegada (casos reales: marca "VENIER DrOx" con título
 * "VENIER - DR. OX. …" quedaba "Venier Dr. Ox. esmalte…", y "RUST OLEUM SP" con
 * "RUST OLEUM - ACABADO …" quedaba "Rust oleum acabado…").
 *
 * Sigue siendo por TOKENS, que es la garantía que importa: la marca "ALBA" NO
 * matchea "ALBALATEX", así que "Albalatex mate interior" conserva su nombre.
 */
function stripBrandPrefix(title: string, brand: string | null | undefined): Pass {
  const brandTokens = collapse(brand ?? '')
    .split(' ')
    .filter(Boolean);
  if (!brandTokens.length) return pass(title);

  const titleTokens = title.split(' ');
  let matched = 0;
  while (
    matched < brandTokens.length &&
    titleTokens[matched] !== undefined &&
    fold(titleTokens[matched]!) === fold(brandTokens[matched]!)
  ) {
    matched += 1;
  }
  if (!matched) return pass(title);

  const rest = titleTokens.slice(matched).join(' ');
  // Un artículo cuyo nombre ES la marca se queda como está: mejor un título
  // redundante que un producto sin título.
  if (!rest.replace(/[-|\s.]/g, '')) return pass(title);
  return pass(collapse(rest), ['R01']);
}

/**
 * Cantidad a la forma argentina: coma decimal y sin ceros de relleno (R06).
 *
 * `1.000` NO es un decimal: tres dígitos exactos después del punto son el
 * separador de miles, y tratarlo como decimal convertiría 1.000 cc en 1 cc.
 */
function normalizeNumber(raw: string): { value: string; changed: boolean } {
  const thousands = /^(\d{1,3})\.(\d{3})$/.exec(raw);
  if (thousands) return { value: `${thousands[1]}${thousands[2]}`, changed: true };

  const parts = raw.split(/[.,]/);
  if (parts.length !== 2) return { value: raw, changed: false };
  const fraction = parts[1]!.replace(/0+$/, '');
  const value = fraction ? `${parts[0]},${fraction}` : parts[0]!;
  return { value, changed: value !== raw };
}

/**
 * Cantidad a la forma de la tienda: fracción controlada resuelta y coma decimal
 * (R06/R07). Es la versión sin trazabilidad, para los pasos que no reportan por
 * cantidad (pulgadas y listas de medidas).
 */
const canonicalQuantity = (raw: string): string =>
  raw.includes('/') ? (FRACTIONS[raw] ?? raw) : normalizeNumber(raw).value;

/** Forma canónica de la unidad, o `null` si no está en el mapa. */
function resolveUnit(raw: string, linearMeters: boolean): string | null {
  const key = unitKey(raw);
  // `ML` en una moldura son metros lineales, no mililitros (R23).
  if (linearMeters && (key === 'ml' || key === 'mls')) return 'm lineales';
  return UNITS[key] ?? null;
}

/**
 * Litros comerciales del envase de una base entonable (R25). El ERP carga el
 * contenido de BASE, no el del envase: los 0,1 l que faltan para el litro los
 * ocupa el entonado, así que la base de `3,6 lts` es el balde de 4 litros de la
 * góndola.
 *
 * Por defecto es el entero de arriba, y `TINT_BASE_CAN_LITERS` corrige las
 * capacidades donde ese entero no es el envase que se vende (`8,7` → 10,
 * `17,4` → 20).
 *
 * Se aplica sólo si la unidad es litros y sólo a las bases: redondear un barniz
 * de `0,25 lt` a `1 lt` sería mentir sobre el envase.
 */
function commercialLiters(quantity: string, unit: string): string {
  if (unit !== TINT_BASE_ROUNDING_UNIT) return quantity;
  const value = Number(quantity.replace(',', '.'));
  // Una fracción sin regla de conversión (`3/4`) llega acá como vino: no se toca.
  if (!Number.isFinite(value) || value <= 0) return quantity;
  const declared = TINT_BASE_CAN_LITERS.find(([content]) => Math.abs(value - content) < 0.01);
  return String(declared ? declared[1] : Math.ceil(value));
}

/**
 * ¿El título es de una base entonable? Decide si aplica R25.
 *
 * Reusa el detector del tintométrico y no un regex propio: es el que ya sabe que
 * "BASE DE almendras x1 lt" no es una base y que sin tamaño no hay base. Se exige
 * `high` porque un `low` es exactamente el caso que alguien tiene que revisar a
 * mano, y redondearle el envase sería decidir por él.
 */
const isTintableBaseTitle = (title: string): boolean =>
  parseTintingBase(title)?.confidence === 'high';

/** ¿El artículo es un perfil que se vende por metro? Decide qué es `ML` (R23). */
const hasLinearMeterTerm = (title: string): boolean =>
  fold(title)
    .split(/[^\p{L}]+/u)
    .some((token) => LINEAR_METER_TERMS.has(token));

/**
 * Cantidad + unidad en cualquier parte del título: separa el número de la
 * unidad, pasa la unidad a su forma canónica, resuelve la fracción y el decimal
 * y se come el punto residual (R04/R05/R06/R07/R17/R23).
 */
function normalizeMeasures(title: string, linearMeters: boolean): Pass {
  const rules = new Set<string>();
  const warnings: string[] = [];

  const out = title.replace(MEASURE_RE, (match, rawNumber: string, rawUnit: string) => {
    const unit = resolveUnit(rawUnit, linearMeters);
    // No debería pasar: el patrón se construye desde `UNITS`. Si pasa, no se toca.
    if (!unit) return match;
    // Una marca que se escribe como medida (`3M`) no es una medida.
    if (BRAND_LIKE_MEASURES.has(fold(match).replace(/\s+/g, ''))) return match;

    let quantity = rawNumber;
    if (quantity.includes('/')) {
      const decimal = FRACTIONS[quantity];
      if (decimal) {
        quantity = decimal;
        rules.add('R07');
      } else {
        warnings.push(
          `Fracción "${quantity}" sin regla de conversión: queda como vino hasta que se defina (R07).`
        );
      }
    } else {
      const number = normalizeNumber(quantity);
      if (number.changed) rules.add('R06');
      quantity = number.value;
    }

    // La unidad, el espacio o el punto: cualquiera de los tres cambia → R17. El
    // número se reporta aparte (R06/R07).
    if (match !== `${rawNumber} ${unit}`) rules.add(unit === 'm lineales' ? 'R23' : 'R17');
    return `${quantity} ${unit}`;
  });

  return pass(collapse(out), [...rules], warnings);
}

/**
 * Qué hacer con un paréntesis (R19).
 *
 * `keep` es el único caso en que sobreviven: el paréntesis trae una CANTIDAD
 * ("2 m lineales", "8 per"), o sea una presentación o un dato técnico
 * complementario, y ahí los paréntesis son la puntuación correcta.
 */
function classifyParenthetical(inner: string, factoryCode?: string | null): 'keep' | 'strip' | 'drop' {
  const content = collapse(inner);
  if (!content) return 'drop';
  // Una lista de números son las medidas de un juego y se integran al título con
  // el símbolo de pulgada (R24), así que estos paréntesis SÍ se abren.
  if (NUMBER_LIST_RE.test(content)) return 'strip';
  if (/^\d+(?:[.,]\d+)?\s+\p{L}/u.test(content)) return 'keep';
  if (isInternalArticleCode(content, factoryCode)) return 'drop';
  return 'strip';
}

/**
 * ¿El contenido del paréntesis es el código interno del artículo? (R27)
 *
 * El caso son los 236 títulos de desdeelsur que terminan en un número suelto —
 * `2X Ultra Cover azul oasis satinado 337475`, `Cinta duct tape 48 mm 18,2 m
 * blanca 63885`—: en el crudo venían entre paréntesis y R19 los ABRÍA, porque
 * abrir un código es lo correcto para `(C118)` (`Cúter plástico C118 18 mm`).
 *
 * La condición es deliberadamente estrecha, y son las tres cosas a la vez:
 *
 *  1. dígitos PUROS. Deja afuera `C118`, `Q107`, `N30`, `D-53344`: un código con
 *     letra es el modelo con el que el cliente conoce la herramienta.
 *  2. CINCO dígitos o más. Deja afuera los doce paréntesis de cuatro, que
 *     incluyen los modelos de Skil (`1831`, `5402`, `7232`, `7351`, `7640`).
 *  3. aparece en `zeus_codigo_fabrica`. Es la prueba de que ese número es la
 *     referencia interna y no un dato del producto. Sin ella se salvan los tres
 *     discos 3M (`28672` contra un código `61035 3M`) y los tres Rust-Oleum que
 *     el ERP tiene con los dígitos transpuestos (`252156` contra `262156`) —
 *     ahí el dato está mal cargado y adivinar cuál de los dos vale no es
 *     trabajo de una regla de formato.
 */
function isInternalArticleCode(content: string, factoryCode?: string | null): boolean {
  if (!/^\d{5,8}$/.test(content)) return false;
  const reference = (factoryCode ?? '').replace(/\D/g, '');
  return reference.length > 0 && reference.includes(content);
}

/**
 * Contenido de un paréntesis que se abre. Un código técnico va en mayúsculas
 * (R19): es un solo token que mezcla letras y dígitos, así que `(c118)` sale
 * `C118` y `(chicos)` sigue siendo una palabra. Una lista de números sale como
 * medidas en pulgadas separadas por comas (R24).
 */
function openParenthetical(inner: string): string {
  const content = collapse(inner);
  if (NUMBER_LIST_RE.test(content)) {
    const measures = (content.match(/\d+(?:[.,]\d+)?/g) ?? []).map(
      (number) => `${canonicalQuantity(number)}"`
    );
    return measures.length > 1
      ? `${measures.slice(0, -1).join(', ')} y ${measures[measures.length - 1]}`
      : (measures[0] ?? content);
  }
  if (!/\s/.test(content) && /\d/.test(content) && /\p{L}/u.test(content)) {
    return content.toUpperCase();
  }
  return content;
}

/** Abre los paréntesis descriptivos e integra su contenido al título (R19). */
function integrateParentheses(title: string, factoryCode?: string | null): Pass {
  let hit = false;

  // Primero los que siguen a una medida: su contenido se adelanta.
  let out = title.replace(PAREN_AFTER_MEASURE_RE, (match, measure: string, inner: string) => {
    const kind = classifyParenthetical(inner, factoryCode);
    if (kind === 'keep') return match;
    hit = true;
    if (kind === 'drop') return measure;
    return `${openParenthetical(inner)} ${measure}`;
  });

  // El resto se integra donde está.
  out = out.replace(PAREN_RE, (match, inner: string) => {
    const kind = classifyParenthetical(inner, factoryCode);
    if (kind === 'keep') return match;
    hit = true;
    return kind === 'drop' ? ' ' : ` ${openParenthetical(inner)} `;
  });

  return pass(collapse(out), hit ? ['R19'] : []);
}

/**
 * Deja los paréntesis en condiciones de ser procesados, ANTES de todo lo demás
 * (R27).
 *
 * Dos cosas que la gestión manda rotas:
 *
 *  - Pegados a la palabra de al lado: `25 MM.(3 LLAVES)COD.6070`. `lowercaseWords`
 *    ve `MM.(3` y `LLAVES)COD.6070` como tokens que mezclan letras y dígitos, o
 *    sea códigos, y los deja tal cual — por eso el título guardado gritaba
 *    `(3 LLAVES)` en mayúsculas en medio de una frase en minúscula.
 *  - Sin cerrar: `SELLADOR MADERAS NOGAL X 280 GRS.(GMX`. El texto se cortó al
 *    cargarlo y lo que quedó no significa nada; `PAREN_RE` necesita el cierre,
 *    así que sin esto el fragmento sobrevive entero hasta la tienda.
 */
function repairParentheses(title: string): Pass {
  const rules: string[] = [];
  // El fragmento sin cerrar del final se va con todo lo que lo sigue.
  let out = title;
  const opened = out.lastIndexOf('(');
  if (opened !== -1 && !out.includes(')', opened)) {
    out = out.slice(0, opened);
    rules.push('R27');
  }
  const spaced = out.replace(/(?<=[\p{L}\p{N}.])\(/gu, ' (').replace(/\)(?=[\p{L}\p{N}])/gu, ') ');
  if (spaced !== out) {
    out = spaced;
    if (!rules.length) rules.push('R27');
  }
  return pass(collapse(out), rules);
}

/** Código de artículo que la gestión rotula ella misma: `COD.6070` (R27). */
const LABELLED_CODE_RE = /\bcod\.?\s*\d{3,8}\b/giu;

/**
 * Quita el código rotulado. Va aparte de `isInternalArticleCode` porque no
 * necesita comparar contra nada: la gestión ya dijo que es un código al
 * escribirle `COD` adelante, y ninguno de los cinco casos reales coincide con
 * `zeus_codigo_fabrica` (los candados Wembley llevan `COD.6070` contra un código
 * de fábrica `31864`).
 */
function stripLabelledCode(title: string): Pass {
  const out = title.replace(LABELLED_CODE_RE, ' ');
  return pass(collapse(out), out !== title ? ['R27'] : []);
}

/** Dimensión sin unidad declarada: `100X610`, `12X30`, `4X19` (R28). */
const UNITLESS_DIMENSION_RE = /(?<=\d)X(?=\d)/g;

/**
 * La `x` de una dimensión va en minúscula aunque el artículo no declare la
 * unidad (R28).
 *
 * `normalizeCompoundMeasures` (R18) resuelve `48mmX50Mts` porque puede anclarse
 * en la unidad; sin ella no matchea, y `lowercaseWords` deja `100X610` intacto
 * porque un token que mezcla letras y dígitos es, para R02, un código. Eran 181
 * títulos de desdeelsur gritando una `X` en el medio: lijas de banda, llanas,
 * tarugos, tornillos.
 *
 * Sólo entre dígitos: `2X Ultra Cover` y `3M` no se tocan.
 */
function normalizeUnitlessDimensions(title: string): Pass {
  const out = title.replace(UNITLESS_DIMENSION_RE, 'x');
  return pass(out, out !== title ? ['R28'] : []);
}

/**
 * Medidas compuestas (R18): `x` minúscula y sin espacios cuando las dos medidas
 * comparten unidad (`20x30 cm`, `5x100 mm`), con la unidad una sola vez al
 * final; con unidades distintas cada valor conserva la suya y la `x` va
 * separada (`5 m x 19 mm`).
 *
 * Solo aplica a unidades de LONGITUD: `3 en 1 x 200 cc` no es una medida
 * compuesta, es una expresión comercial seguida de la presentación.
 */
function normalizeCompoundMeasures(title: string): Pass {
  let hit = false;
  const out = title.replace(
    COMPOUND_RE,
    (match, first: string, firstRaw: string | undefined, second: string, secondRaw: string) => {
      const secondUnit = UNITS[unitKey(secondRaw)];
      if (!secondUnit || !DIMENSION_UNITS.has(secondUnit)) return match;
      const firstUnit = firstRaw ? UNITS[unitKey(firstRaw)] : undefined;
      if (firstUnit && !DIMENSION_UNITS.has(firstUnit)) return match;

      const replacement =
        !firstUnit || firstUnit === secondUnit
          ? `${first}x${second} ${secondUnit}`
          : `${first} ${firstUnit} x ${second} ${secondUnit}`;
      if (replacement !== match) hit = true;
      return replacement;
    }
  );
  return pass(out, hit ? ['R18'] : []);
}

/** Pega la `x` de presentación a la cantidad, sin tocar la de medida compuesta (R03). */
function glueMultiplier(title: string): Pass {
  const out = title.replace(GLUE_RE, (_match, precedingMeasure: string | undefined) =>
    precedingMeasure ? `${precedingMeasure}x ` : 'x'
  );
  return pass(out, out === title ? [] : ['R03']);
}

/** Numeraciones a una sola forma, sin ceros a la izquierda (R21). */
function normalizeNumbering(title: string): Pass {
  const out = title.replace(NUMBERING_RE, (_match, digits: string) => {
    const trimmed = digits.replace(/^0+(?=\d)/, '');
    return `N.º ${trimmed}`;
  });
  return pass(out, out === title ? [] : ['R21']);
}

/**
 * Expresiones comerciales: `3EN1` → `3 en 1`, `SET 3` → `Set de 3` (R22).
 *
 * La regla se reporta comparando las formas PLEGADAS: "2 EN 1" ya está bien
 * escrito y solo le falta el caso, que lo arregla R02, así que no ensucia el log.
 */
function normalizeCommercialExpressions(title: string): Pass {
  const out = title
    .replace(THREE_IN_ONE_RE, (_match, left: string, right: string) => `${left} en ${right}`)
    .replace(SET_OF_RE, (match) => `${match.trimEnd()} de `);
  return pass(out, fold(out) === fold(title) ? [] : ['R22']);
}

/**
 * Pulgadas con el símbolo pegado al número (R24). `4 1/2 pulgadas` es UNA medida
 * (cuatro y medio), no dos: sin esto la fracción se convertía sola y el entero
 * quedaba huérfano ("4 0,5\"").
 */
function normalizeInches(title: string): Pass {
  const out = title.replace(INCH_RE, (_match, whole: string | undefined, number: string) => {
    if (!whole) return `${canonicalQuantity(number)}"`;
    const decimals = number.includes('/') ? (FRACTIONS[number]?.split(',')[1] ?? null) : null;
    if (decimals) return `${whole},${decimals}"`;
    return `${whole} ${canonicalQuantity(number)}"`;
  });
  return pass(out, out === title ? [] : ['R24']);
}

/** La `/` que separa dos palabras se elimina; la de abreviatura o código queda (R20). */
function normalizeSlashes(title: string): Pass {
  const out = collapse(title.replace(SLASH_SEPARATOR_RE, ' '));
  return pass(out, out === title ? [] : ['R20']);
}

type Presentation = {
  /** Como se escribe al final del título: `x0,25 l`. */
  inTitle: string;
  /** Sin la `x`, para la metadata y la opción de variante: `0,25 l`. */
  standalone: string;
  rules: string[];
};

/** Medida al final del texto, con la unidad ya resuelta. */
type TrailingMeasure = {
  quantity: string;
  unit: string;
  /** Texto que queda delante de la medida. */
  rest: string;
  /** Como venía escrita, para poder comparar y reportar solo lo que cambió. */
  raw: string;
  index: number;
};

function matchTrailingMeasure(text: string): TrailingMeasure | null {
  const match = TRAILING_MEASURE_RE.exec(text);
  if (!match) return null;
  const unit = UNITS[unitKey(match[3]!)];
  if (!unit) return null;
  const index = match.index;
  return {
    quantity: match[2]!,
    unit,
    rest: text.slice(0, index).trimEnd(),
    raw: collapse(match[0]!),
    index,
  };
}

/**
 * Separa la presentación del final del título (R03).
 *
 * Exige unidad de CAPACIDAD O PESO conocida: sin eso, un modelo o una medida de
 * herramienta al final del nombre ("ACRILICO G2 010", "PINCEL N 10", "disco 115
 * mm") se leería como presentación (excepción de R03). Y no puede venir pegada a
 * otra medida (`5x100 mm`), porque ahí la cantidad es parte de la compuesta.
 *
 * La `x` se agrega SIEMPRE, la traiga o no el origen: es la forma de la tienda
 * ("… amarillo 4 L" → "… amarillo x4 lt").
 *
 * `tintBase` activa el redondeo del envase (R25): es el único lugar donde se
 * decide la cantidad de la presentación, así que es el único que puede hacerlo sin
 * que el título y la metadata se contradigan.
 */
function extractPresentation(
  title: string,
  tintBase: boolean
): { rest: string; presentation: Presentation | null; warnings: string[] } {
  const measure = matchTrailingMeasure(title);
  if (!measure) {
    // Con `x` explícita es casi seguro una presentación: se avisa para que
    // alguien agregue la unidad al mapa, pero el título se normaliza igual (R15).
    const unknown = UNKNOWN_PRESENTATION_RE.exec(title);
    const warnings = unknown
      ? [
          `Unidad desconocida en la presentación "${collapse(unknown[0]!)}": el título se normalizó ` +
            'igual y la unidad quedó como vino.',
        ]
      : [];
    return { rest: title, presentation: null, warnings };
  }

  if (!PRESENTATION_UNITS.has(measure.unit)) return { rest: title, presentation: null, warnings: [] };
  // Parte de una medida compuesta (`5x100 mm`, `2x5 l`): no es la presentación.
  if (/[xX\d]$/.test(title.slice(0, measure.index))) {
    return { rest: title, presentation: null, warnings: [] };
  }

  const quantity = tintBase ? commercialLiters(measure.quantity, measure.unit) : measure.quantity;
  const standalone = `${quantity} ${measure.unit}`;
  const inTitle = `x${standalone}`;
  // Una presentación que ya venía normalizada no reporta reglas: `applied` es
  // "qué cambió", no "qué se evaluó" (lo lee el log del sync).
  const rules = measure.raw === inTitle ? [] : ['R03'];
  if (quantity !== measure.quantity) rules.push('R25');
  return {
    rest: measure.rest,
    presentation: { inTitle, standalone, rules },
    warnings: [],
  };
}

/**
 * Minúsculas palabra por palabra, salvo los códigos técnicos: un token que mezcla
 * letras y dígitos ("G2", "4D", "602.HCP4", "2X") es un modelo o un código de
 * fábrica y no una palabra, y tanto R02 como R10 piden conservarlos. Va en código
 * y no en el diccionario porque los modelos del catálogo no se pueden enumerar.
 */
function lowercaseWords(title: string): string {
  return title
    .split(' ')
    .map((token) => (/\p{L}/u.test(token) && /\d/.test(token) ? token : token.toLowerCase()))
    .join(' ');
}

/**
 * Aplica el diccionario sobre el título ya en minúsculas, matcheando frases
 * plegadas por TOKENS (no por índices de caracteres: plegar puede cambiar la
 * longitud). Greedy de más larga a más corta, así "ultra cover" gana sobre
 * "ultra".
 *
 * Devuelve también si la última frase reemplazada termina en punto: con eso el
 * paso de "quitar el punto final" no se come el de una abreviatura como
 * "Dr. Ox." cuando queda al final del nombre.
 */
function applyDictionary(
  title: string,
  dictionary: Record<string, string>
): { title: string; hit: boolean; endsWithAbbreviation: boolean } {
  const entries = Object.entries(dictionary);
  if (!entries.length) return { title, hit: false, endsWithAbbreviation: false };

  const maxTokens = entries.reduce((max, [key]) => Math.max(max, key.split(' ').length), 1);
  const tokens = title.split(' ');
  const out: string[] = [];
  let hit = false;
  let endsWithAbbreviation = false;

  for (let i = 0; i < tokens.length; ) {
    let matched = false;
    for (let size = Math.min(maxTokens, tokens.length - i); size >= 1; size -= 1) {
      const phrase = fold(tokens.slice(i, i + size).join(' '));
      const replacement = dictionary[phrase];
      if (replacement === undefined) continue;
      out.push(replacement);
      if (replacement !== tokens.slice(i, i + size).join(' ')) hit = true;
      endsWithAbbreviation = replacement.endsWith('.') && i + size === tokens.length;
      i += size;
      matched = true;
      break;
    }
    if (!matched) {
      const token = tokens[i]!;
      // `c/iman` → `c/imán`: la abreviatura se conserva tal cual (R20) y la
      // palabra que la sigue pasa por el diccionario como cualquier otra.
      const abbreviation = /^(\p{L}\/)(\p{L}+)$/u.exec(token);
      const replacement = abbreviation ? dictionary[fold(abbreviation[2]!)] : undefined;
      if (abbreviation && replacement !== undefined) {
        const rebuilt = `${abbreviation[1]}${replacement}`;
        if (rebuilt !== token) hit = true;
        out.push(rebuilt);
      } else {
        out.push(token);
      }
      endsWithAbbreviation = false;
      i += 1;
    }
  }

  return { title: out.join(' '), hit, endsWithAbbreviation };
}

/**
 * Caso de lectura (R02) + diccionario (R10) sobre un texto suelto.
 *
 * Existe para que `product-description.ts` aplique EXACTAMENTE el mismo criterio
 * de casing y acentuación que el título, en vez de una copia que con el tiempo
 * diverge: el día que alguien agregue "poliuretánico" al diccionario, la
 * descripción tiene que corregirse igual que el nombre del producto.
 *
 * No incluye la mayúscula inicial: el título la pone una sola vez y la
 * descripción, en cada oración.
 */
export function applyReadingCase(text: string, rules: TitleRules): string {
  // Se procesa por TRAMOS de palabras y no de una sola pasada. El diccionario
  // matchea por token plegado, y en prosa los tokens vienen con la puntuación
  // pegada: sin separarla, `AZULEJOS, CERAMICOS` deja `ceramicos,` sin acentuar.
  // El tramo mantiene los espacios adentro para que las entradas de varias
  // palabras ("ultra cover") sigan matcheando, y la `/` para `c/imán`.
  return collapse(text).replace(/[\p{L}\p{N}][\p{L}\p{N}\s/]*[\p{L}\p{N}]|[\p{L}\p{N}]/gu, (run) =>
    applyDictionary(lowercaseWords(run), rules.dictionary).title
  );
}

/**
 * Presentación que declara un título YA normalizado: `… x20 lt` → `20 lt`.
 *
 * El camino normal para saber la presentación de una variante es
 * `metadata.zeus_presentacion`, que deja el catalog sync. Esto es el respaldo
 * para las variantes que no lo tienen —las ~117 bases entonables, que las crea
 * `tinting/bases/sync-products` y nunca pasaron por el catalog sync— y el título
 * es la única fuente que les queda.
 *
 * Pide el espacio antes de la `x` a propósito: `Cobertor multiuso 3x3 m` declara
 * una dimensión, no un envase, y no tiene que devolver nada.
 */
export function presentationFromNormalizedTitle(title: string | null | undefined): string | null {
  const match = /\sx(\S.*)$/.exec(collapse(title ?? ''));
  return match ? normalizePresentationLabel(match[1]) : null;
}

/**
 * Saca del título la base tintométrica: `ESMALTE BASE F` → `ESMALTE` (R11 la
 * detecta, R26 la quita). Es una regla GENERAL para cualquier letra o clase de
 * dos, no una lista cerrada: el tintométrico de la cuenta tiene bases A, B, C, D,
 * F, T, W, MF… y cada línea nueva trae la suya. Las líneas de base ÚNICA, que no
 * tienen letra, pierden el `base` igual.
 *
 * Se van los DOS tokens, `base` incluido: "Albacryl látex interior acrílico mate
 * base x4 lt" leería como si la base fuera parte del nombre, y no lo es — el
 * comprador elige un color y el motor del tintométrico resuelve en qué base se
 * prepara. La letra sigue viva donde importa: en `metadata.tint_base_letter` del
 * producto y en la tabla `erp_tinting_base`.
 *
 * Tres excepciones, las dos primeras por el español y no por el rubro:
 *
 *  - "sin base", "solo base": ahí `base` es un sustantivo común y lo que sigue no
 *    es su letra ("sin base y a pedido" no es la base Y).
 *  - `y`, `o`, `e`, `u` y las palabras de dos letras (`de`, `al`, `en`…): son
 *    conjunciones y preposiciones, nunca la letra de una base.
 *  - la `x`: es el "por" del tamaño. Zeus escribe "BASE X P 17,4 LTS" —la X ANTES
 *    de la letra— en ~58 artículos con letra P; leerla como la letra dejaría la P
 *    de verdad en el título. Cuando hay letra detrás, la `x` se va con ella. El
 *    mismo criterio que ya aplica el detector del tintométrico
 *    (`tinting/parse-base.ts`, donde `LEADING_LETTER` excluye la X a mano).
 */
function stripBaseLetters(
  title: string,
  opts: { hasPresentation: boolean }
): { title: string; hit: boolean } {
  const tokens = title.split(' ');
  const remove = new Set<number>();
  /** Los tres índices de cada match, para poder reconstruir `Base P` si hace falta. */
  const matches: Array<{ base: number; letter: number; separator: number | null }> = [];

  /** ¿`base` es sustantivo común por lo que viene antes? ("sin base", "solo base"). */
  const isNoun = (index: number): boolean =>
    index > 0 && BASE_AS_NOUN.has(fold(tokens[index - 1]!));

  for (let i = 0; i < tokens.length - 1; i += 1) {
    if (fold(tokens[i]!) !== 'base') continue;
    if (isNoun(i)) continue;

    // La `x` cuenta como separador SÓLO si lo que sigue es una letra de base: en
    // "base x 2 lt" sigue siendo un multiplicador, y en "base x" a secas (la forma
    // de una base ÚNICA, "BASE X 3,24 LTS") no hay ninguna letra que quitar.
    const separated = fold(tokens[i + 1]!) === 'x' && isBaseLetter(tokens[i + 2]);
    const letterIndex = separated ? i + 2 : i + 1;
    if (!isBaseLetter(tokens[letterIndex])) continue;

    remove.add(i);
    remove.add(letterIndex);
    // La `x` del medio se va con ellos: la presentación la vuelve a escribir
    // pegada al número ("x18 lt") y acá sólo quedaría huérfana.
    if (separated) remove.add(i + 1);
    matches.push({ base: i, letter: letterIndex, separator: separated ? i + 1 : null });
  }

  // Base ÚNICA: `base` sin letra, pegado a la presentación ("ALBA … MARMOL BASE X
  // 3,24 LTS"). A esta altura la presentación ya se separó del título, así que
  // "pegado" es "es el último token".
  //
  // Exigir la presentación es lo que hace segura la regla, y es el mismo criterio
  // del detector del tintométrico (`SIZE_ANCHORED` en `tinting/parse-base.ts`:
  // sin tamaño no hay base). Sin ese guard, un artículo que simplemente termina en
  // la palabra ("masilla base") perdería parte del nombre.
  const last = tokens.length - 1;
  if (
    opts.hasPresentation &&
    last >= 0 &&
    !remove.has(last) &&
    fold(tokens[last]!) === 'base' &&
    !isNoun(last)
  ) {
    remove.add(last);
  }

  if (!remove.size) return { title, hit: false };

  const rest = tokens.filter((_, index) => !remove.has(index));
  if (rest.some((token) => /\p{L}/u.test(token))) return { title: rest.join(' '), hit: true };

  // Un artículo cuyo nombre ES la base ("BASE P X 4 LTS", "BASE X 3,24 LTS", sin
  // línea delante) no se queda sin título: mejor el dato técnico que un producto
  // llamado "x4 lt". Es el mismo criterio que `stripBrandPrefix`. Ahí se escribe
  // `Base P`: la `x` del medio se va igual y la letra va en mayúscula, que es como
  // la nombra el rubro.
  const kept = [...tokens];
  const separators = new Set(matches.map((match) => match.separator));
  for (const match of matches) {
    kept[match.base] = 'Base';
    kept[match.letter] = kept[match.letter]!.toUpperCase();
  }
  const fallback = kept.filter((_, index) => !separators.has(index)).join(' ');
  return { title: fallback, hit: fallback !== title };
}

/**
 * Normaliza una etiqueta de presentación SUELTA (`3,6 LTS` → `3,6 lt`, `18MM` →
 * `18 mm`), sin título alrededor. Devuelve `null` si el texto no es una medida
 * (`Único`, `Default`, un color).
 *
 * Es la misma lógica que usa el título, expuesta aparte porque el valor de la
 * opción de variante vive en otro lado: lo escriben el alta del catálogo, el
 * import y el sync de bases tintométricas, y todos tienen que llegar a la MISMA
 * forma que el título para que la card y el nombre no se contradigan.
 *
 * Acepta cualquier unidad conocida, no solo las de presentación: una etiqueta que
 * dice `18 MM` también tiene que quedar en minúscula (R17).
 *
 * `tintBase: true` redondea los litros al envase de góndola (R25). Lo pide quien
 * SABE que la etiqueta es de una base entonable —acá no hay título del que
 * deducirlo—, y es obligatorio para el sync de bases: el título de esa misma base
 * ya sale redondeado, y sin esto la opción diría `3,6 lt` al lado de un nombre que
 * dice `x4 lt`.
 */
export function normalizePresentationLabel(
  raw: string | null | undefined,
  opts: { tintBase?: boolean } = {}
): string | null {
  const text = collapse(raw ?? '');
  if (!text) return null;
  const measured = normalizeMeasures(text, hasLinearMeterTerm(text));
  const measure = matchTrailingMeasure(measured.text);
  // Tiene que ser SOLO la medida: si sobra texto es otra cosa (un color, un
  // acabado, "Pack x6") y no se toca.
  if (!measure || measure.rest.trim()) return null;
  const quantity = opts.tintBase
    ? commercialLiters(measure.quantity, measure.unit)
    : measure.quantity;
  return `${quantity} ${measure.unit}`;
}

/**
 * Etiquetas de envase que una versión ANTERIOR de R25 escribió para el MISMO
 * contenido de base.
 *
 * Existe porque agregar una excepción a `TINT_BASE_CAN_LITERS` deja huérfanas las
 * etiquetas ya guardadas: cuando `17,4` pasó de `18 lt` a `20 lt`
 * (DESDEELSUR-23), el título del producto se reescribió —lo dispara
 * `TITLE_RULES_VERSION`— pero el `product_option_value` y el título de la
 * variante se quedaron en `18 lt`, y ahí `planPresentationOptions` los clasifica
 * como etiqueta escrita a mano y NO los toca. O sea: la card dice `x20 lt` y el
 * chip de abajo dice `18 lt`, para siempre, aunque se vuelva a sincronizar.
 * Es el estado real de los SKU 745, 748, 767, 770 y 993 de desdeelsur.
 *
 * Devuelve las formas superadas de `target`, para que quien compara pueda
 * reconocerlas como la misma medida y pisarlas. Sólo aplica a los litros de una
 * base: es el único lugar donde el envase no es el número que carga el ERP.
 */
export function supersededPresentationLabels(target: string | null | undefined): string[] {
  const text = collapse(target ?? '');
  if (!text) return [];
  const measure = matchTrailingMeasure(normalizeMeasures(text, false).text);
  if (!measure || measure.rest.trim() || measure.unit !== TINT_BASE_ROUNDING_UNIT) return [];

  const value = Number(measure.quantity.replace(',', '.'));
  if (!Number.isFinite(value)) return [];

  // El redondeo por defecto de todo contenido que HOY declara este envase. Si
  // coincide con el envase declarado no hay nada superado (`3,6 → 4` es las dos
  // cosas a la vez).
  //
  // El `Set` no es defensivo: dos contenidos distintos pueden redondear a la
  // misma etiqueta superada y declarar el mismo envase. `17,4` y `18` son los dos
  // el balde de 20 y los dos escribieron `18 lt`, así que sin deduplicar la
  // función devolvería `['18 lt', '18 lt']`.
  const superseded = new Set(
    TINT_BASE_CAN_LITERS.filter(([, can]) => can === value).map(
      ([content]) => `${Math.ceil(content)} ${measure.unit}`
    )
  );
  superseded.delete(`${measure.quantity} ${measure.unit}`);
  return [...superseded];
}

/** Mayúscula en la primera letra del título; el resto ya viene resuelto (R02). */
function capitalizeFirst(title: string): string {
  const index = title.search(/[\p{L}\p{N}]/u);
  if (index === -1) return title;
  return title.slice(0, index) + title[index]!.toUpperCase() + title.slice(index + 1);
}

/**
 * Título del ERP → título de la tienda. Aplica las reglas en este orden, que es
 * el único que hace pasar los casos reales de la especificación:
 *
 *  1. colapsar espacios (R08)
 *  2. quitar leyendas promocionales aprobadas (R09)
 *  3. quitar la marca del inicio si coincide con el atributo (R01/R13)
 *  4. eliminar `-` y `|` (R08/R16)
 *  5. la `/` que separa dos palabras (R20)
 *  6. numeraciones, expresiones comerciales y pulgadas (R21/R22/R24)
 *  7. cantidad + unidad en todo el título (R04–R07/R17/R23)
 *  8. abrir los paréntesis descriptivos (R19) — después de las medidas, porque
 *     necesita saber si el paréntesis viene detrás de una
 *  9. medidas compuestas y `x` de presentación (R18/R03)
 * 10. separar la presentación del final (R03)
 * 11. minúsculas (R02), diccionario (R10) y quitar la letra de base (R11/R26)
 * 12. mayúscula inicial (R02) y re-adjuntar la presentación (R03)
 */
export function normalizeProductTitle(
  raw: string | null | undefined,
  opts: { brand?: string | null; factoryCode?: string | null; rules: TitleRules }
): NormalizedTitle {
  const applied = new Set<string>();
  const warnings: string[] = [];

  const original = collapse(raw ?? '');
  if (!original) return { title: null, presentation: null, applied: [], warnings: [] };

  const linearMeters = hasLinearMeterTerm(original);
  let working = original;

  const run = (step: Pass): void => {
    working = step.text;
    for (const rule of step.rules) applied.add(rule);
    warnings.push(...step.warnings);
  };

  // Antes que nada: los paréntesis rotos de la gestión. Todo lo que sigue —R09,
  // R19, R02— asume que un paréntesis está cerrado y separado de sus vecinos.
  run(repairParentheses(working));
  run(stripPromoLegends(working, opts.rules.promoLegends));
  if (opts.rules.stripBrand) run(stripBrandPrefix(working, opts.brand));

  // R16 no tiene excepciones: ningún título visible lleva `-` ni `|`.
  if (/[-|]/.test(working)) {
    working = collapse(working.replace(/[-|]/g, ' '));
    applied.add('R16');
  }

  run(normalizeSlashes(working));
  run(normalizeNumbering(working));
  run(normalizeCommercialExpressions(working));
  run(normalizeInches(working));
  run(normalizeMeasures(working, linearMeters));
  run(integrateParentheses(working, opts.factoryCode));
  run(stripLabelledCode(working));
  run(normalizeCompoundMeasures(working));
  // Después de R18: lo que quedó con `X` entre dígitos es una dimensión que el
  // artículo no declara en ninguna unidad, y ahí no hay nada que anclar.
  run(normalizeUnitlessDimensions(working));
  run(glueMultiplier(working));

  // Sobre el título ORIGINAL: el detector de bases está escrito contra el texto
  // del ERP ("BASE F X 3,6 LTS") y a esta altura `working` ya pasó por medio
  // pipeline. Igual reconoce las dos formas —de eso depende la idempotencia—,
  // pero preguntarle por el original es lo que no depende de ese detalle.
  const extracted = extractPresentation(working, isTintableBaseTitle(original));
  warnings.push(...extracted.warnings);
  if (extracted.presentation) for (const rule of extracted.presentation.rules) applied.add(rule);

  const dictionary = applyDictionary(lowercaseWords(extracted.rest), opts.rules.dictionary);
  if (dictionary.hit) applied.add('R10');
  const bases = stripBaseLetters(dictionary.title, {
    hasPresentation: extracted.presentation !== null,
  });
  if (bases.hit) applied.add('R26');

  let body = collapse(bases.title);
  // Punto final: se saca salvo que lo aporte una abreviatura del diccionario
  // ("Dr. Ox."), donde forma parte de la forma aprobada.
  if (!dictionary.endsWithAbbreviation && /\.+$/.test(body)) {
    body = body.replace(/\.+$/, '').trimEnd();
    applied.add('R08');
  }
  body = capitalizeFirst(body);
  // El formato de lectura se reporta comparando contra lo que entró al paso: así
  // un título que ya venía bien escrito no ensucia el log con R02.
  if (body !== extracted.rest) applied.add('R02');

  const title = collapse(
    extracted.presentation ? `${body} ${extracted.presentation.inTitle}` : body
  );
  // Invariante que sostiene la política de reescritura del sync: si el título no
  // cambió, no se aplicó ninguna regla. Vale también para el caso en que solo se
  // colapsaron espacios (R08), que no tiene paso propio.
  if (title === original) {
    return { title, presentation: extracted.presentation?.standalone ?? null, applied: [], warnings };
  }
  if (!applied.size) applied.add('R08');

  return {
    title: title || null,
    presentation: extracted.presentation?.standalone ?? null,
    applied: [...applied].sort(),
    warnings,
  };
}
