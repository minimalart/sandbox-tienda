import type { SettingDescriptor } from './descriptors/types';
import type { SiteResolution } from '../../lib/multistore/types';

/**
 * La PRECEDENCIA de la decisión 3 de `EXTENSIONES-MULTITIENDA.md`, escrita una vez
 * y sin I/O.
 *
 *   is_main            → site ?? global ?? env ?? default
 *   NO main            → site ?? OFF
 *   sin site (mono)    → global ?? env ?? default
 *
 * Son TRES reglas distintas y la del medio es la que justifica el archivo entero:
 * una tienda secundaria que no configuró lo suyo **no hereda nada**. Ni la global,
 * ni el env, ni el default. Heredar acá no es "un fallback razonable": es despachar
 * con la cuenta de Andreani de otra tienda, facturar contra su CUIT o mandar un
 * WhatsApp desde su número. El precedente vive en `lib/multistore/credentials.ts:117`
 * — un blob indescifrable NO cae al env por exactamente el mismo motivo.
 *
 * Función PURA: sin container, sin `process.env`, sin Medusa. El env llega YA
 * coercionado por `coerceFromEnv()` y los secretos YA descifrados. Quien lee la DB
 * es el llamador; acá sólo se decide QUIÉN GANA. Esa separación es lo que permite
 * testear las tres reglas con `node:test` sin base (ver `validate.ts`, misma idea).
 *
 * `SettingSource` vive ACÁ y `resolve.ts` lo RE-EXPORTA. Durante la transición
 * hubo dos tipos homónimos con miembros distintos —el de `resolve.ts` era
 * `'db' | 'env' | 'default' | 'unset'`— y eso no se sostuvo ni un commit: un
 * `Record<SettingSource, …>` escrito contra el viejo compilaba con tres ramas
 * faltantes. El `'db'` de la era mono-tienda se partió en `'site' | 'global'` y
 * apareció `'off'`, que antes no existía porque no existían las secundarias.
 */

/** `'none'` = no hay capa de tienda aplicable. Ver `siteKindOf`. */
export type SiteKind = 'main' | 'secondary' | 'none';

/**
 * De dónde salió el valor efectivo.
 *
 *  'site'     fila de ESTA tienda.
 *  'global'   fila global de la instancia (`site_setting.site_id IS NULL`).
 *  'env'      variable de entorno del descriptor.
 *  'default'  constante del descriptor.
 *  'off'      FAIL-CLOSED: tienda secundaria que no declaró este valor. Puede
 *             haber global y env perfectamente cargados: se ignoran a propósito.
 *  'unset'    no hay valor en ninguna capa. NO es lo mismo que `'off'`.
 *
 * `'off'` y `'unset'` separados no es cosmética. Conflatearlos hace que a la tienda
 * principal a la que le falta una credencial `required` la UI le muestre "apagado
 * a propósito" en vez de "sin configurar" — o sea, esconde la única falla que había
 * que ver. Son dos estados con dos acciones distintas: uno se arregla cargando el
 * valor global, el otro cargándoselo A ESA tienda.
 *
 * `'unset'` no estaba en el enunciado; se agrega por eso, y conserva el nombre que
 * ya usaba el resolver mono-tienda para no inventar vocabulario nuevo.
 */
export type SettingSource = 'site' | 'global' | 'env' | 'default' | 'off' | 'unset';

export type Resolved = {
  /** `undefined` en `'off'` y en `'unset'`. */
  value: unknown;
  source: SettingSource;
};

/**
 * Las cuatro capas. Objeto y no argumentos posicionales A PROPÓSITO: `site` y
 * `global` son los dos `unknown`, así que un `resolve(kind, global, site, ...)`
 * invertido compila igual y produce el fail-open que este archivo existe para
 * impedir. Con claves nombradas no hay forma de swapearlas en silencio.
 */
export type PrecedenceInput = {
  kind: SiteKind;
  /** Valor de la fila de esta tienda. Ausente = `undefined`. */
  site?: unknown;
  /** Valor de la fila global (`site_id IS NULL`). */
  global?: unknown;
  /** Salida de `coerceFromEnv()` — ya tipada, nunca el string crudo. */
  env?: unknown;
  /** El descriptor entero sirve; se usa sólo `default`. */
  descriptor?: Pick<SettingDescriptor, 'default'>;
};

/**
 * Decisión: `null` es AUSENCIA, no un valor.
 *
 * No es una preferencia estética, es lo que el repo ya hace y lo único que no
 * rompe fail-closed:
 *
 *  1. `write-plan.ts` NO PUEDE producir un `null`. `coerceAndValidate()` lo rechaza
 *     para los ocho tipos (string exige `typeof === 'string'`, json lo rechaza
 *     explícito, boolean convierte `null` en `'null'` y falla…). O sea: un `null`
 *     en la columna no lo escribió el admin nunca. Sale de una fila legacy, de un
 *     UPDATE a mano o de un `JSON.parse` de `{"KEY": null}`.
 *  2. `resolve.ts:90` ya trata el `null` de la fila como "seguí de largo", y
 *     `pickBySitePrecedence` (`scope.ts:409`) usa `== null` para detectar la global.
 *     Que esto opinara distinto haría que dos resolvers del mismo repo discrepen.
 *  3. Si `null` fuese valor, una tienda secundaria con `{"MP_ACCESS_TOKEN": null}`
 *     resolvería a `{value: null, source: 'site'}` y el consumidor intentaría cobrar
 *     con un token nulo, creyendo que está configurado. Como ausencia, da `'off'`,
 *     que es exactamente lo que hay que ver.
 *
 * `undefined` y `null` llegan al mismo lugar, pero por caminos distintos: uno es
 * "la clave no está en el jsonb", el otro "está y vale null". Para la precedencia
 * son lo mismo; para un diagnóstico no, y por eso el llamador conserva la fila.
 *
 * Lo que sí es valor: `false`, `0` y `''`. Un `?? `/`||` mal puesto los perdería —
 * apagar un flag por tienda es el caso de uso más obvio que hay.
 */
const isPresent = (value: unknown): boolean => value !== undefined && value !== null;

const off = (): Resolved => ({ value: undefined, source: 'off' });
const unset = (): Resolved => ({ value: undefined, source: 'unset' });

/**
 * Valor efectivo y su origen.
 *
 * Decisión sobre `descriptor.default`: es el ÚLTIMO eslabón de `main` y de `none`,
 * y NO aplica a `secondary`. Coincide con el criterio del enunciado, pero el motivo
 * no es "el default también se hereda": un default es una constante de código, no
 * datos de otra tienda, así que no filtra nada. El motivo es la COHERENCIA del
 * namespace. Una extensión se configura como unidad; si los campos `required` de
 * una tienda que no declaró nada dan `'off'` y los demás dan su default, la
 * extensión arranca en un estado Frankenstein —medio prendida— que es peor que
 * apagada, porque el operador ve datos y cree que está andando. Fail-closed sólo
 * sirve si es total: para una tienda que no declaró el namespace, TODAS sus keys
 * dan `'off'`.
 *
 * TRAMPA CONOCIDA, no resuelta acá (hace falta decidirla en `resolve.ts`/UI):
 * esto es fail-closed POR KEY, y la decisión 3 copia el namespace entero al CREAR
 * la tienda. Agregar un `SettingDescriptor` nuevo después deja a toda tienda
 * secundaria ya existente con esa key en `'off'` en silencio, aunque haya declarado
 * la integración hace meses. Las salidas son backfill al publicar el descriptor, o
 * pasar el fail-closed a nivel NAMESPACE ("¿esta tienda declaró la integración?")
 * y dentro de un namespace declarado dejar caer al `default` —nunca a global/env—.
 * Si se elige la segunda, entra como una capa más en `PrecedenceInput`, no como un
 * `if` suelto en el llamador.
 */
export function resolveByPrecedence(input: PrecedenceInput): Resolved {
  const { kind, site, global: globalValue, env, descriptor } = input;

  // Regla 2 (fail-closed). Va PRIMERA y sale por return: así no hay forma de que un
  // refactor la deje "cayendo" a las líneas de abajo por accidente.
  if (kind === 'secondary') {
    return isPresent(site) ? { value: site, source: 'site' } : off();
  }

  // `'none'` IGNORA `site` aunque venga. Es lo único que distingue `'none'` de
  // `'main'`, y es lo que hace que el admin sin tienda elegida vea la config de la
  // instancia y no la de una tienda cualquiera.
  if (kind === 'main' && isPresent(site)) return { value: site, source: 'site' };

  if (isPresent(globalValue)) return { value: globalValue, source: 'global' };
  if (isPresent(env)) return { value: env, source: 'env' };
  // Mismo criterio que arriba: un `default: null` declarado es no declarar default.
  if (isPresent(descriptor?.default)) return { value: descriptor?.default, source: 'default' };
  return unset();
}

/**
 * `SiteResolution` → `SiteKind`. Las cinco variantes, una por una:
 *
 *  site         → `is_main` de la propia `SiteRef`. Es la única regla que mira una
 *                 tienda concreta.
 *  singleSite   → `'none'`. Ver la nota de abajo: NO es `'main'`.
 *  allSites     → `'none'`. En `/admin/*` "sin tienda elegida" significa TODAS
 *                 (`types.ts:35-40`), y la config de "todas" es la de la instancia.
 *  registryAbsent → `'none'`. Proyecto sin multitienda: sólo hay global y env, que
 *                 es literalmente el comportamiento previo a esta migración.
 *  unknownSite  → `'secondary'`. FAIL-CLOSED. Un id stale NO puede terminar leyendo
 *                 la config global: es el mismo fail-open que documenta
 *                 `types.ts:43-50`. El guard de request igual tiene que tirar
 *                 (`scope.ts:86`, `UNKNOWN_SITE_ERROR_CODE`); esto es la segunda
 *                 línea, para el día que alguien se olvide de llamarlo.
 *
 * NO recibe un `isMain` por parámetro aunque el enunciado lo proponía: `SiteRef` ya
 * lo trae (`types.ts:21`). Un segundo parámetro sería una segunda fuente de verdad
 * que puede contradecir a la resolución, y el modo de falla es "la tienda B se
 * evalúa como principal" — o sea, el leak que todo esto evita.
 *
 * POR QUÉ `singleSite` → `'none'` y no `'main'`, que es la decisión menos obvia del
 * archivo: `resolve-site.ts:150` devuelve `singleSite` ANTES del fallback a la
 * principal, así que en un proyecto de una sola tienda TODA request cae acá — y el
 * admin, con `singleSite`, tampoco tiene tienda activa, así que escribe en la fila
 * GLOBAL. Leer de la fila de la tienda mientras se escribe en la global es
 * exactamente "guardo y no pasa nada".
 *
 * La contra —real— es la transición a la segunda tienda: la decisión 3 copia el
 * global de cada namespace al CREAR una tienda, así que la tienda 1 puede tener
 * filas propias congeladas en el momento de su creación. Mientras es única no las
 * lee; el día que nace la tienda 2 pasa a `'site'`/`'main'` y empieza a leerlas,
 * perdiendo todo lo editado en la etapa mono-tienda. Eso NO se arregla acá: se
 * arregla en el alta de la segunda tienda (refrescar la copia de la principal desde
 * la global) o haciendo que el admin escriba en la misma capa que se lee. La
 * invariante que hay que sostener afuera es esa: **se escribe donde se lee**.
 */
export function siteKindOf(resolution: SiteResolution): SiteKind {
  switch (resolution.status) {
    case 'site':
      return resolution.site.is_main ? 'main' : 'secondary';
    case 'singleSite':
    case 'allSites':
    case 'registryAbsent':
      return 'none';
    case 'unknownSite':
      return 'secondary';
    default: {
      // Exhaustividad: agregar una variante a `SiteResolution` rompe la compilación
      // acá en vez de caer callada en una rama. En runtime, fail-closed.
      const impossible: never = resolution;
      void impossible;
      return 'secondary';
    }
  }
}

/** Azúcar para el caso normal: resolver directo desde la resolución de la request. */
export function resolveForSite(
  resolution: SiteResolution,
  layers: Omit<PrecedenceInput, 'kind'>,
): Resolved {
  return resolveByPrecedence({ ...layers, kind: siteKindOf(resolution) });
}
