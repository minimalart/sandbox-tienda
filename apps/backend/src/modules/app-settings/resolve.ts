import type { SettingDescriptor } from './descriptors/types';
import type { SiteResolution } from '../../lib/multistore/types';
import { maskSecret, tryDecryptSecret } from './crypto';
import {
  type Resolved,
  type SettingSource,
  type SiteKind,
  resolveByPrecedence,
  siteKindOf,
} from './precedence';
import { getSnapshotRow } from './snapshot';
import { coerceFromEnv } from './validate';

/**
 * Resolución de un ajuste contra `site_setting`, con la precedencia de la
 * decisión 3 de `EXTENSIONES-MULTITIENDA.md`.
 *
 *   scope: 'instance'  → global ?? env ?? default        (la tienda NO participa)
 *   scope: 'site'      → is_main:      site ?? global ?? env ?? default
 *                        NO main:      site ?? OFF
 *                        sin tienda:   global ?? env ?? default
 *
 * Este archivo NO decide quién gana: eso vive en `precedence.ts`, que es puro y
 * está testeado sin base. Acá se traduce el MUNDO REAL —filas con secretos
 * cifrados, `process.env`, el break-glass— a las cuatro capas que esa función
 * espera, y se arma el estado que ve el admin.
 *
 * NO hay seed. El env queda como fallback vivo para siempre, y eso es deliberado:
 *
 *  - Un seed correría con el environment equivocado. Las migraciones van por
 *    `pnpm migrate` / `predeploy`, un shell que puede tener sólo `DATABASE_URL`:
 *    escribiría `""` sobre decenas de keys de forma permanente y encima taparía
 *    el env que sí tenía los valores buenos. Silencioso e irreversible.
 *  - Destruye la única señal que importa: con fallback, existe entrada SI Y SÓLO
 *    SI un humano sobreescribió. Toda la columna "Origen" del buscador central se
 *    apoya en esa distinción.
 *  - Hay rollback: borrás la entrada y volvés al env.
 *  - Sobrevive a copias de DB: restaurar un dump de prod en staging conserva el
 *    env de staging para todo lo no sobreescrito a mano.
 *
 * Este archivo es SERVER-ONLY (lee `process.env` y descifra). El admin importa
 * `descriptors/`, nunca esto.
 *
 * SOBRE LOS SECRETOS: los de los DESCRIPTORES se cifran con `./crypto.ts` y viven
 * dentro del jsonb de `site_setting`. Las credenciales de las integraciones con
 * lector propio (`andreani`, `correo-argentino`, `kapso`) viven en
 * `site_credential`, se cifran con `lib/multistore/credentials.ts` y NO pasan por
 * acá. Son dos sistemas con dos claves distintas a propósito; mezclarlos haría que
 * rotar una clave brickeara los dos dominios.
 */

/**
 * Se re-exporta el `SettingSource` de `precedence.ts` en vez de declarar uno
 * propio. Este archivo tenía el suyo (`'db' | 'env' | 'default' | 'unset'`) y
 * tener dos tipos homónimos con miembros distintos en el mismo módulo es una
 * bomba de tiempo: el `'db'` de la era mono-tienda se partió en
 * `'site' | 'global'` y apareció `'off'`, así que un `Record<SettingSource, …>`
 * escrito contra el viejo compilaba y le faltaban tres ramas.
 */
export type { Resolved, SettingSource, SiteKind } from './precedence';

/**
 * Una clave YA LEÍDA de un scope de `site_setting`.
 *
 * Sigue llamándose `AppSettingRow` aunque la tabla `app_setting` ya no exista:
 * es el SOBRE de una clave (valor + ciphertext + autoría), y es lo que
 * `site-setting-store.ts` produce al desarmar el jsonb del namespace. Renombrarlo
 * tocaría diez archivos sin cambiar nada.
 */
export type AppSettingRow = {
  key: string;
  value: unknown;
  ciphertext: string | null;
  is_secret: boolean;
  updated_at?: string | Date | null;
  updated_by?: string | null;
};

/**
 * Las DOS capas de base que puede tener una clave.
 *
 * Objeto con claves nombradas y no dos posicionales, por el mismo motivo que
 * `PrecedenceInput`: las dos son `AppSettingRow | undefined`, así que invertirlas
 * compila igual y produce el fail-open que todo esto existe para impedir.
 */
export type SettingScopeRows = {
  /** Entrada de la fila de ESTA tienda. `undefined` si no hay tienda o no la declaró. */
  site?: AppSettingRow;
  /** Entrada de la fila GLOBAL de la instancia (`site_setting.site_id IS NULL`). */
  global?: AppSettingRow;
};

export type ResolveOptions = {
  /**
   * Tienda de la request. `undefined` = NO HAY REQUEST (camino sincrónico,
   * jobs, providers): se resuelve como instancia. Ver `resolveSettingSync`.
   */
  resolution?: SiteResolution;
  envRead?: EnvRead;
};

/** Lo que la API le devuelve al admin. Nunca incluye un secreto en claro. */
export type AppSettingState = {
  namespace: string;
  key: string;
  source: SettingSource;
  /**
   * Hay entrada en el scope que esta pantalla EDITA — o sea, alguien la
   * sobreescribió ACÁ. Con una tienda activa es la fila de la tienda; sin tienda
   * (o para un descriptor `scope: 'instance'`) es la global.
   *
   * NO es "tiene valor": un ajuste heredado del env tiene valor y `is_set: false`.
   * Y con una tienda activa, un valor que viene de la global también da `false`,
   * que es justo lo que hay que ver — la tienda todavía no forkeó ese ajuste.
   */
  is_set: boolean;
  /** Valor en claro. SIEMPRE `null` para descriptores de tipo `secret`. */
  value: unknown;
  /** `••••1234`. Sólo para secretos guardados y descifrables. */
  preview?: string | null;
  /** `false` cuando la clave de cifrado rotó. No es un error: es un estado. */
  decryptable?: boolean;
  /** Alguna de las env vars del descriptor está presente y no vacía. */
  env_present: boolean;
  updated_at: string | null;
  updated_by: string | null;
};

type EnvRead = (name: string) => string | undefined;

const defaultEnvRead: EnvRead = (name) => process.env[name];

/**
 * Break-glass. Con `APP_SETTINGS_DISABLE=true` el resolver ignora la base por
 * completo y el backend se comporta exactamente como antes de esta migración.
 * Es la salida cuando un valor mal guardado deja el sitio caído — y por eso es
 * una env var y no un setting: tiene que funcionar aunque la tabla sea el
 * problema. Documentarlo en el runbook, no descubrirlo durante el incidente.
 *
 * OJO: apaga TAMBIÉN el fail-closed. Sin esto, una tienda secundaria en
 * break-glass quedaría en `'off'` en vez de caer al env — o sea, la palanca de
 * emergencia apagaría las integraciones en vez de restaurarlas. Ver
 * `effectiveSiteKind`.
 */
export function isDbLayerDisabled(envRead: EnvRead = defaultEnvRead): boolean {
  return envRead('APP_SETTINGS_DISABLE') === 'true';
}

/**
 * El `SiteKind` EFECTIVO de un descriptor: cruza su `scope` con la tienda de la
 * request. Es la única traducción de "esto es de la tienda o de la instancia" a
 * la precedencia, y por eso es pública: `service.ts` la usa para saber en qué
 * scope de `site_setting` escribir.
 *
 * Las tres razones para devolver `'none'`, en orden de prioridad:
 *
 *  1. break-glass prendido → se comporta como antes de la migración.
 *  2. `scope: 'instance'` → el ajuste NO varía por tienda. Nunca lee la fila de
 *     la tienda y nunca cae en fail-closed: una tienda secundaria que no declaró
 *     el `TYPESENSE_HOST` de la instancia no tiene que quedarse sin buscador.
 *  3. sin `SiteResolution` → no hay request de dónde sacar la tienda.
 */
export function effectiveSiteKind(
  descriptor: Pick<SettingDescriptor, 'scope'>,
  resolution: SiteResolution | undefined,
  envRead: EnvRead = defaultEnvRead,
): SiteKind {
  if (isDbLayerDisabled(envRead)) return 'none';
  if (descriptor.scope === 'instance') return 'none';
  if (!resolution) return 'none';
  return siteKindOf(resolution);
}

/**
 * El valor que aporta UNA capa de base, ya en claro.
 *
 * Un secreto indescifrable (clave rotada) devuelve `null`, que la precedencia
 * trata como AUSENCIA: el resolver sigue de largo hacia la capa siguiente. Eso
 * es lo que mantiene el sitio en pie mientras alguien reingresa el valor, y no
 * es una excepción a fail-closed — para una tienda secundaria "seguir de largo"
 * significa `'off'`, no caer a la global.
 */
const layerValue = (row: AppSettingRow | undefined): unknown =>
  !row ? undefined : row.is_secret ? tryDecryptSecret(row.ciphertext) : row.value;

/**
 * Valor EFECTIVO y su ORIGEN. Los secretos vienen descifrados: es la única salida
 * en claro del sistema, y nunca pasa por una respuesta HTTP.
 */
export function resolveSetting(
  descriptor: SettingDescriptor,
  rows: SettingScopeRows,
  options: ResolveOptions = {},
): Resolved {
  const envRead = options.envRead ?? defaultEnvRead;
  const dbOff = isDbLayerDisabled(envRead);
  return resolveByPrecedence({
    kind: effectiveSiteKind(descriptor, options.resolution, envRead),
    site: dbOff ? undefined : layerValue(rows.site),
    global: dbOff ? undefined : layerValue(rows.global),
    env: coerceFromEnv(descriptor, envRead),
    descriptor,
  });
}

/** Igual, pero devolviendo sólo el valor. Es el 90% de los call sites. */
export function resolveEffectiveValue(
  descriptor: SettingDescriptor,
  rows: SettingScopeRows,
  options: ResolveOptions = {},
): unknown {
  return resolveSetting(descriptor, rows, options).value;
}

/* -------------------------------------------------------------------------- */
/* Camino SINCRÓNICO                                                           */
/* -------------------------------------------------------------------------- */

/**
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ LIMITACIÓN REAL: EL CAMINO SINCRÓNICO SÓLO VE LA CONFIGURACIÓN DE LA      │
 * │ INSTANCIA. NUNCA LA DE UNA TIENDA.                                        │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Esto NO es un detalle de implementación pendiente de pulir: es una propiedad
 * del lugar desde donde se llama. `resolveSettingSync` existe para consumidores
 * que corren en un CONSTRUCTOR SIN CONTENEDOR y sin poder esperar una promesa —
 * el caso testigo es `TypeSenseService`, que se instancia con `new` en 35
 * lugares. Un constructor así no tiene request, no tiene `SiteResolution`, y no
 * hay forma de que la tenga: la tienda es un dato de la REQUEST, y en ese punto
 * del programa no hay ninguna.
 *
 * Entonces la decisión es explícita y consciente:
 *
 *   scope: 'instance'  → funciona EXACTAMENTE igual que siempre. Correcto.
 *   scope: 'site'      → se resuelve con `SiteKind = 'none'`, o sea
 *                        `global ?? env ?? default`. NO se aplica fail-closed y
 *                        NO se lee ninguna fila de tienda.
 *
 * POR QUÉ NO TIRA, que es la alternativa obvia y sería peor: el kill switch de
 * gift-cards (`GIFT_CARD_EXPERIENCE_ENABLED`) se lee por acá desde un hook de
 * workflow puro, y ese namespace es `defaultScope: 'site'`. Hacer que un
 * descriptor `site` explote en el camino sync APAGARÍA la extensión entera en
 * vez de señalar un problema. Lo mismo vale para el `TYPESENSE_RECONCILE_ENABLED`
 * de un job y para las plantillas de WhatsApp.
 *
 * POR QUÉ NO ES UN AGUJERO DE AISLAMIENTO: la capa que se lee es la GLOBAL, que
 * es config de la instancia, no de otra tienda. Nunca se devuelve el valor de la
 * tienda A a la tienda B — eso sí sería el leak que `precedence.ts` documenta.
 * Lo que se pierde es la personalización por tienda, no el aislamiento.
 *
 * CÓMO SE ARREGLA DE VERDAD, cuando haga falta: el call site tiene que dejar de
 * ser sincrónico y pasar la `SiteResolution` (`resolveSetting` ya la acepta). El
 * camino existe; lo que falta es que el consumidor tenga de dónde sacar la
 * tienda. Mientras tanto, un ajuste `scope: 'site'` que SÓLO se lea por acá está,
 * en la práctica, siendo tratado como de instancia — y eso hay que saberlo antes
 * de declarar el descriptor, no después.
 */
export function resolveSettingSync(descriptor: SettingDescriptor): unknown {
  return resolveEffectiveValue(descriptor, {
    global: getSnapshotRow(descriptor.namespace, descriptor.key),
  });
}

/** Resuelve un namespace entero desde el snapshot, indexado por key. */
export function resolveNamespaceSync(descriptors: SettingDescriptor[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const d of descriptors) out[d.key] = resolveSettingSync(d);
  return out;
}

/* -------------------------------------------------------------------------- */
/* Estado para la UI                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Estado para la UI. Función PURA: no toca la base, recibe las filas ya leídas.
 *
 * Lo que hace que valga la pena leerla entera son las TRES nociones de "fila" que
 * conviven acá y que no son la misma:
 *
 *  - `ownRow`   la del scope que esta pantalla EDITA. Alimenta `is_set` y
 *               `decryptable`. Con tienda activa es la de la tienda; si no, la
 *               global. Es el "se escribe donde se lee" de `precedence.ts`.
 *  - `valueRow` la que GANÓ la precedencia. Alimenta el `preview` del secreto,
 *               que tiene que corresponderse con el `source` que se muestra al
 *               lado: mostrar la cola de un secreto que no se está usando es
 *               peor que no mostrar nada.
 *  - ninguna    `off`, `unset`, `env`, `default`.
 */
export function computeSettingState(
  descriptor: SettingDescriptor,
  rows: SettingScopeRows,
  options: ResolveOptions = {},
): AppSettingState {
  const envRead = options.envRead ?? defaultEnvRead;
  const dbDisabled = isDbLayerDisabled(envRead);
  // En break-glass no hay capa de base: ni para el valor ni para la autoría.
  const layers: SettingScopeRows = dbDisabled ? {} : rows;

  const kind = effectiveSiteKind(descriptor, options.resolution, envRead);
  const ownRow = kind === 'none' ? layers.global : layers.site;

  const resolved = resolveSetting(descriptor, rows, { ...options, envRead });
  const valueRow =
    resolved.source === 'site'
      ? layers.site
      : resolved.source === 'global'
        ? layers.global
        : undefined;

  const envPresent = coerceFromEnv(descriptor, envRead) !== undefined;

  const base = {
    namespace: descriptor.namespace,
    key: descriptor.key,
    source: resolved.source,
    is_set: ownRow !== undefined,
    env_present: envPresent,
    // Autoría del valor que se está USANDO. Si no lo produjo ninguna fila
    // (env/default/off/unset) pero el scope propio tiene una entrada rota — un
    // secreto indescifrable —, se muestra la de esa entrada: es el único dato
    // que le dice al operador cuándo se cargó lo que dejó de funcionar.
    updated_at: toIso((valueRow ?? ownRow)?.updated_at),
    updated_by: (valueRow ?? ownRow)?.updated_by ?? null,
  };

  if (descriptor.type === 'secret') {
    return {
      ...base,
      // El claro NUNCA sale por la API. Sólo la cola de cuatro.
      value: null,
      preview: maskSecret(valueRow?.is_secret ? tryDecryptSecret(valueRow.ciphertext) : null),
      // `decryptable` habla de LO GUARDADO en este scope, no de lo que se usa: es
      // lo que le dice a la UI "reingresá este valor". Sin entrada propia no hay
      // nada que reingresar, así que la clave ni aparece.
      ...(ownRow?.is_secret ? { decryptable: tryDecryptSecret(ownRow.ciphertext) !== null } : {}),
    };
  }

  // `off` y `unset` no tienen valor; `env` y `default` sí, y son los que hacen
  // que la card muestre lo heredado en gris en vez de un input vacío.
  return { ...base, value: resolved.value ?? null };
}

function toIso(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}
