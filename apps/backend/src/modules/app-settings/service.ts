import { MedusaError } from '@medusajs/framework/utils';
import type { MedusaContainer } from '@medusajs/framework/types';
import { SCOPE_SEPARATOR, invalidateNamespace, memoNamespace } from '../../lib/settings-cache';
import { UNKNOWN_SITE_ERROR_CODE } from '../../lib/multistore/types';
import type { SiteResolution } from '../../lib/multistore/types';
import type { SettingDescriptor } from './descriptors/types';
import {
  type AppSettingState,
  type SettingScopeRows,
  computeSettingState,
  resolveEffectiveValue,
} from './resolve';
import {
  type ApplyPlanForSiteResult,
  type NamespaceScopeRead,
  type SiteScopeId,
  applyPlanForSite,
  readGlobalNamespace,
  readNamespaceScopes,
} from './site-setting-store';
import { replaceSnapshotNamespace } from './snapshot';
import type { PlannedWrite, WritePlan } from './write-plan';

/**
 * La API de `app-settings`: FUNCIONES que reciben el container del que llama.
 *
 * ## Por qué no es un service de módulo, que es lo que era hasta acá
 *
 * Porque no puede serlo. El host de la configuración pasó a ser `site_setting`,
 * que es una tabla del módulo de TIENDAS (`demo_store`), y Medusa le da a cada
 * service de módulo un container HERMÉTICO: `load-internal.js:123-129` crea uno
 * sin padre y le re-exporta seis claves (`MANAGER`, `CONFIG_MODULE`, `LOGGER`,
 * `PG_CONNECTION`, `EVENT_BUS`, `CACHING`), y después instancia el service con
 * `new moduleService(localContainer.cradle, …)`. Desde ahí,
 * `container.resolve('demo_store')` TIRA SIEMPRE.
 *
 * Eso no es una limitación esquivable: es la regla de aislamiento de módulos de
 * Medusa v2, y está bien que exista. Lo que estaría mal es fingir que no está.
 * Un `AppSettingsModuleService` registrado en el container y resuelto con
 * `req.scope.resolve(APP_SETTINGS_MODULE)` se vería idéntico a código correcto y
 * degradaría TODAS las lecturas a `process.env` en silencio — porque
 * `resolveSiteSettingsStore()` devuelve `null` cuando no encuentra el módulo, que
 * es el comportamiento correcto para un proyecto SIN multitienda y el peor
 * posible para uno que sí la tiene. Sería exactamente el fail-open que esta rama
 * entera existe para eliminar.
 *
 * Con funciones que reciben el container del LLAMADOR (`req.scope`, que sí es
 * hijo del container compartido y sí ve `demo_store`), el requisito es imposible
 * de olvidar: no hay instancia que se pueda pedir mal.
 *
 * El módulo `appSettings` sigue registrado en `medusa-config.ts`, pero SÓLO para
 * hospedar el loader que llena el snapshot sincrónico — ver `index.ts`.
 *
 * ## Qué NO vive acá
 *
 * Toda la parte decidible: la coerción (`validate.ts`), el merge del plan
 * (`write-plan.ts`), la precedencia (`precedence.ts`), el merge del jsonb y la
 * clasificación de carreras (`site-setting-store.ts`). Los tests de este repo no
 * tienen base, así que lo que se puede testear tiene que estar afuera del IO.
 */

/**
 * Momento en que arrancó ESTE proceso. Lo publica `GET /admin/app-settings` como
 * `process_started_at`.
 *
 * Nació para computar `boot_stale` —"un ajuste `tier: 'boot'` cambió después de
 * arrancar, hace falta reiniciar"—. Ese cálculo se eliminó junto con el tier, que
 * prometía una lectura que `medusa-config.ts` nunca hizo (ver el docblock de
 * `SettingTier`); con cero descriptores `boot` sólo podía devolver `false`.
 *
 * La constante se queda porque sigue contestando la pregunta que un operador hace
 * cuando algo no cuadra: "¿este proceso levantó antes o después de que yo tocara
 * esto?". Es un dato del proceso, no un flag guardado, así que no puede quedar
 * pegado ni necesita limpieza.
 */
export const PROCESS_STARTED_AT = new Date();

/* -------------------------------------------------------------------------- */
/* Scope                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * El scope de `site_setting` que esta resolución LEE y ESCRIBE.
 *
 * Es la contraparte de `siteKindOf`, y las dos tienen que estar de acuerdo o se
 * rompe la invariante "se escribe donde se lee" que documenta `precedence.ts`:
 *
 *   site         → la fila de esa tienda.
 *   singleSite   → `null`. Con una sola tienda el admin no tiene tienda activa y
 *                  `siteKindOf` da `'none'`: lee la global, escribe la global.
 *   allSites     → `null`. "Todas" es la instancia.
 *   registryAbsent → `null`. Proyecto sin multitienda: sólo existe la global.
 *   unknownSite  → `null`, y por eso ESCRIBIR con esta resolución está prohibido
 *                  (ver `assertWritable`). Para LEER es inocuo: `siteKindOf` da
 *                  `'secondary'` y `rowsForKey` no le pasa fila de tienda, así
 *                  que todo cae en `'off'`, que es el fail-closed correcto.
 */
export function siteScopeIdOf(resolution: SiteResolution | undefined): SiteScopeId {
  return resolution?.status === 'site' ? resolution.site.id : null;
}

/**
 * Un id de tienda stale NO puede terminar escribiendo la configuración de la
 * instancia. Es el mismo criterio que `scope.ts:86` y el mismo código de error,
 * para que el admin sepa limpiar su tienda persistida y volver a elegir.
 */
function assertWritable(resolution: SiteResolution | undefined): void {
  if (resolution?.status === 'unknownSite') {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `${UNKNOWN_SITE_ERROR_CODE}: la tienda solicitada no existe o fue eliminada.`,
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Lectura                                                                     */
/* -------------------------------------------------------------------------- */

/** Las dos filas que hacen falta para decidir precedencia. */
export type NamespaceScopes = {
  /** La del scope pedido. Con `siteId === null` es la MISMA instancia que `global`. */
  own: NamespaceScopeRead;
  global: NamespaceScopeRead;
};

/**
 * La cache es POR SCOPE, no por namespace.
 *
 * Con la clave vieja (sólo el namespace) la primera request de la tienda A
 * dejaba cacheado su jsonb y la tienda B leía el de A durante 30 segundos: un
 * cross-tenant leak con TTL. `invalidateNamespace()` borra el prefijo entero,
 * así que guardar sigue invalidando todos los scopes de una.
 */
const cacheKey = (namespace: string, siteId: SiteScopeId): string =>
  `${namespace}${SCOPE_SEPARATOR}${siteId ?? '*global*'}`;

/**
 * Las entradas de un namespace para un scope y para la global, memoizadas.
 *
 * Se cachea el SOBRE, NUNCA el secreto descifrado: el descifrado pasa en cada
 * lectura, en `resolveSetting`.
 */
export function getNamespaceRows(
  container: MedusaContainer,
  namespace: string,
  siteId: SiteScopeId,
): Promise<NamespaceScopes> {
  return memoNamespace(cacheKey(namespace, siteId), () =>
    readNamespaceScopes(container, namespace, siteId),
  );
}

/**
 * Las dos capas de UNA clave.
 *
 * `site` va en `undefined` cuando NO hay tienda, aunque `own` tenga la entrada:
 * con `siteId === null`, `readNamespaceScopes` devuelve la global en las dos
 * puntas, y pasarla también como capa de tienda haría que un `unknownSite`
 * —que resuelve como `'secondary'`— leyera la global con origen `'site'`. O sea:
 * el fail-open exacto que el fail-closed existe para impedir.
 */
function rowsForKey(scopes: NamespaceScopes, key: string, siteId: SiteScopeId): SettingScopeRows {
  return {
    site: siteId === null ? undefined : scopes.own.rows.get(key),
    global: scopes.global.rows.get(key),
  };
}

/**
 * Valor efectivo de un ajuste. Los secretos vienen descifrados: es para uso
 * interno del backend, nunca para una respuesta HTTP.
 */
export async function resolveSettingFor<T = unknown>(
  container: MedusaContainer,
  descriptor: SettingDescriptor,
  resolution?: SiteResolution,
): Promise<T | undefined> {
  const siteId = siteScopeIdOf(resolution);
  const scopes = await getNamespaceRows(container, descriptor.namespace, siteId);
  return resolveEffectiveValue(descriptor, rowsForKey(scopes, descriptor.key, siteId), {
    resolution,
  }) as T | undefined;
}

/**
 * Igual que `resolveSettingFor` pero para varios descriptores, agrupando por
 * namespace para no hacer una lectura por clave.
 */
export async function resolveMany(
  container: MedusaContainer,
  descriptors: SettingDescriptor[],
  resolution?: SiteResolution,
): Promise<Record<string, unknown>> {
  const siteId = siteScopeIdOf(resolution);
  const out: Record<string, unknown> = {};
  for (const [namespace, list] of groupByNamespace(descriptors)) {
    const scopes = await getNamespaceRows(container, namespace, siteId);
    for (const d of list) {
      out[d.key] = resolveEffectiveValue(d, rowsForKey(scopes, d.key, siteId), { resolution });
    }
  }
  return out;
}

/** Estado para el admin. Nunca incluye un secreto en claro. */
export async function getStates(
  container: MedusaContainer,
  descriptors: SettingDescriptor[],
  resolution?: SiteResolution,
): Promise<AppSettingState[]> {
  const siteId = siteScopeIdOf(resolution);

  // Los namespaces se piden EN PARALELO, no en un `for` con `await` adentro.
  //
  // El buscador central de `/settings/extension-settings` es el único llamador que
  // pide todos los namespaces de una, y era el que pagaba: un viaje a la base por
  // namespace, en fila. Con 13 extensiones se disimulaba; la migración los lleva a
  // más del doble, y ahí son treinta y pico de round trips secuenciales para pintar
  // una pantalla. Contra una base remota con 20ms de latencia eso es medio segundo
  // de nada.
  //
  // Es seguro porque `getNamespaceRows` memoiza por (namespace, siteId) y el memo
  // es a prueba de estampida: varias llamadas concurrentes por la misma clave
  // comparten una sola promesa en vuelo. Sin esa garantía, paralelizar acá
  // multiplicaría las consultas en vez de solaparlas.
  //
  // `Promise.all` preserva el orden del array, así que la salida es idéntica a la
  // del loop serial. No es un detalle: la pantalla pagina sobre este orden.
  const byNamespace = await Promise.all(
    [...groupByNamespace(descriptors)].map(async ([namespace, list]) => {
      const scopes = await getNamespaceRows(container, namespace, siteId);
      return list.map((d) =>
        computeSettingState(d, rowsForKey(scopes, d.key, siteId), { resolution }),
      );
    }),
  );

  return byNamespace.flat();
}

/*
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ NO HAY `isBootStale`, Y NO ES UN OLVIDO.                                 │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Existió: devolvía `true` cuando una entrada de un descriptor `tier: 'boot'` se
 * había guardado después de `PROCESS_STARTED_AT`, y con eso el admin pintaba el
 * cartel de "hace falta reiniciar". El cálculo estaba bien; lo que estaba mal era
 * la premisa. `medusa-config.ts` NUNCA lee la base, así que reiniciar tampoco
 * aplicaba el valor: el cartel mandaba a hacer una maniobra que no servía para
 * nada. Se eliminó junto con el tier — ver el docblock de `SettingTier`, que
 * documenta qué habría que cablear para reintroducirlo.
 */

/* -------------------------------------------------------------------------- */
/* Escritura                                                                   */
/* -------------------------------------------------------------------------- */

export type ApplyPlanInput = {
  onlyMissing?: boolean;
  namespace: string;
  /** Los descriptores del namespace: de ahí sale el `scope` de cada clave. */
  descriptors: SettingDescriptor[];
  plan: Extract<WritePlan, { ok: true }>;
  actorId: string | null;
  resolution?: SiteResolution;
};

export type ApplyPlanResult = {
  /** Un elemento por scope tocado. Vacío si el plan no cambiaba nada. */
  scopes: ApplyPlanForSiteResult[];
};

/**
 * Aplica un plan ya validado por `buildWritePlan`.
 *
 * ## El plan se PARTE por scope de descriptor
 *
 * Un namespace puede mezclar claves `scope: 'site'` y `scope: 'instance'`
 * (`defineSettings` permite override por descriptor), y las dos NO van a la misma
 * fila: la de instancia vive siempre en la global. Escribir todo junto en la fila
 * de la tienda haría que un ajuste declarado como de instancia se volviera de
 * tienda en silencio — y el síntoma sería el peor de todos: "en la tienda B anda
 * distinto" sin un solo error.
 *
 * Hoy ningún namespace mezcla, así que en la práctica esto hace UNA escritura. El
 * split está igual porque el costo de escribirlo es un `filter` y el costo de no
 * escribirlo se paga el día que alguien agregue el primer descriptor mixto, sin
 * darse cuenta de que rompió algo.
 *
 * Cada scope se escribe con `applyPlanForSite`, que es quien resuelve el
 * read-modify-write del jsonb, el CAS por revisión y el "la fila de la tienda se
 * CREA partiendo de la global, nunca se hereda el id del GET".
 */
export async function applyPlan(
  container: MedusaContainer,
  input: ApplyPlanInput,
): Promise<ApplyPlanResult> {
  assertWritable(input.resolution);

  const { namespace, plan, actorId } = input;
  const siteId = siteScopeIdOf(input.resolution);
  const scopeOf = new Map(input.descriptors.map((d) => [d.key, d.scope]));

  /** A qué fila va una clave: la de instancia SIEMPRE a la global. */
  const targetOf = (key: string): SiteScopeId => (scopeOf.get(key) === 'instance' ? null : siteId);

  const buckets = new Map<SiteScopeId, { writes: PlannedWrite[]; deletes: string[] }>();
  const bucket = (target: SiteScopeId) => {
    const found = buckets.get(target) ?? { writes: [], deletes: [] };
    buckets.set(target, found);
    return found;
  };
  for (const write of plan.writes) bucket(targetOf(write.key)).writes.push(write);
  for (const key of plan.deletes) bucket(targetOf(key)).deletes.push(key);

  const scopes: ApplyPlanForSiteResult[] = [];
  for (const [target, partial] of buckets) {
    scopes.push(
      await applyPlanForSite(container, {
        namespace,
        siteId: target,
        plan: partial,
        actorId,
        onlyMissing: input.onlyMissing,
      }),
    );
  }

  // Antes de devolver, para que quien acaba de guardar vea su cambio sin esperar
  // el TTL. Borra TODOS los scopes del namespace: el split de arriba puede haber
  // tocado dos filas y la global la lee también la tienda.
  invalidateNamespace(namespace);
  // Refresca el snapshot sincrónico: sin esto, un consumidor que lee en un
  // constructor (Typesense) seguiría viendo lo viejo en ESTE proceso hasta el
  // próximo reinicio, aunque el camino async ya estuviera al día.
  await refreshSnapshot(container, namespace);

  return { scopes };
}

/**
 * Relee el namespace GLOBAL y lo vuelca al snapshot sincrónico de este proceso.
 *
 * Global y no el de la tienda a propósito: el snapshot es la vista de INSTANCIA
 * y no tiene forma de ser otra cosa — lo leen constructores sin request. Ver el
 * cartel de `resolve.ts:resolveSettingSync`. Volcar acá el jsonb de la tienda que
 * acaba de guardar haría que su configuración se filtrara a todas las demás por
 * el camino sincrónico, que es un leak de verdad.
 */
export async function refreshSnapshot(
  container: MedusaContainer,
  namespace: string,
): Promise<void> {
  const global = await readGlobalNamespace(container, namespace);
  replaceSnapshotNamespace(namespace, [...global.rows.values()]);
}

/* -------------------------------------------------------------------------- */

function groupByNamespace(descriptors: SettingDescriptor[]): Map<string, SettingDescriptor[]> {
  const byNamespace = new Map<string, SettingDescriptor[]>();
  for (const d of descriptors) {
    const list = byNamespace.get(d.namespace) ?? [];
    list.push(d);
    byNamespace.set(d.namespace, list);
  }
  return byNamespace;
}
