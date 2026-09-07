/**
 * Reporte del ESTADO DE CONFIGURACIÓN de Correo Argentino.
 *
 * ⚠️ **REGLA ABSOLUTA: acá nunca sale el VALOR de un ajuste.** Sólo el NOMBRE de
 * la clave, booleanos y el ORIGEN. Esta ruta la consume el admin por HTTP, así que
 * ecoar `CORREO_ARGENTINO_API_KEY` en un JSON no es un detalle de diseño: es
 * publicar la credencial de facturación del comercio en la primera pestaña de red
 * que alguien abra. El test `_env-report.test.ts` recorre el reporte serializado
 * buscando cualquier valor de entrada — si alguien agrega un campo con el valor,
 * ese test rompe.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ ESTE REPORTE YA NO MIRA `process.env`. MIRA EL VALOR EFECTIVO.           │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Hasta la migración a `app-settings`, cada fila era `process.env.X !== undefined`
 * y eso ERA la verdad: el entorno era el único lugar donde podía vivir la
 * configuración. Desde que la configuración vive en `site_setting` (y las
 * credenciales en `site_credential`), esa pregunta dejó de tener relación con el
 * estado real: una tienda con su acuerdo y su API key cargados en la base veía las
 * 42 filas en "sin cargar" y el health check le decía que la integración estaba
 * rota justo cuando estaba bien configurada.
 *
 * Un falso negativo en un health check es peor que no tener health check: manda a
 * un operador a "arreglar" algo que anda, y lo más probable es que en el camino
 * pise con un valor del `.env` la configuración buena de la tienda.
 *
 * Ahora cada fila reporta el ORIGEN que devuelve `computeSettingState()`
 * (`modules/app-settings/resolve.ts`), que es exactamente la capa que ganó la
 * precedencia de la decisión 3:
 *
 *   site       la fila de ESTA tienda            global   la fila de la instancia
 *   credential `site_credential` de esta tienda  env      el `.env` del proceso
 *   default    el default del descriptor         off      fail-closed: NO hay valor
 *   unset      no lo aportó ninguna capa
 *
 * `credential` no sale de `computeSettingState`: es la capa que el resolver de
 * descriptores NO ve y que igual GANA en runtime (`applyCorreoSiteCredentials`).
 * Sin ella, una tienda que cargó su cuenta por la pantalla de credenciales vería
 * "sin cargar" acá y despacharía perfecto — el mismo falso negativo, movido de
 * lugar.
 *
 * ─── La lista de claves ──────────────────────────────────────────────────────
 *
 * NO está inventada: sale de los descriptores de `descriptors/correo-argentino.ts`
 * **más** las dos `envOnly` (el cron del job y el flag de los seeds, que no tienen
 * descriptor porque no se pueden gestionar desde la base), cruzado con la sección
 * "Variables de entorno" del `README.md` del módulo, de donde vienen los niveles de
 * obligatoriedad.
 *
 * Que la lista siga completa lo hace cumplir `_env-report.test.ts`, que escanea el
 * módulo, `src/jobs/`, `src/workflows/` y `src/subscribers/` y falla si aparece una
 * `CORREO_ARGENTINO_*` sin catalogar. Escanear SOLO el loader fue el agujero por el
 * que se colaron cinco variables (los flags del grupo `operacion`).
 *
 * Los niveles no son decorativos: son las tres formas distintas en que esta
 * integración se rompe.
 */

import type { SettingSource } from '../../../../modules/app-settings/resolve';
import {
  CORREO_PROD_HOSTNAME,
  CORREO_TEST_HOSTNAME,
  normalizeApiKey,
  normalizeExtClient,
  normalizeHostname,
} from '../../../../modules/correo-argentino-fulfillment/env-options';
import type { CorreoSiteCredentials } from '../../../../modules/correo-argentino-fulfillment/site-credentials';

/** Lo que se lee del entorno: `process.env` o cualquier record equivalente (tests). */
export type EnvLike = Record<string, string | undefined>;

/**
 * De dónde sale el valor efectivo.
 *
 * Son los seis de `SettingSource` más `credential`, que es la capa de
 * `site_credential`: no participa de la precedencia de `app-settings` porque tiene
 * su propio almacén y su propia clave de cifrado, pero PISA a lo que resuelva el
 * descriptor (`applyCorreoSiteCredentials`). Reportar el origen del descriptor
 * cuando quien manda es la credencial sería mentir con más detalle que antes.
 */
export type CorreoSettingSource = SettingSource | 'credential';

export type CorreoEnvRequirement =
  /**
   * Sin ella no se puede llamar a paqar: `probeAuth()` sale con 401 y ningún alta
   * de envío prospera. Son exactamente dos: `apiKey` y `agreement`.
   */
  | 'requerida'
  /**
   * Sin ellas no hay cotización: `calculatePrice()` degrada a $0 y el comprador
   * ve "Gratuito" en cada envío (decisión D4). El provider arranca igual.
   */
  | 'requerida_para_cotizar'
  /**
   * Sin ellas el alta en Correo sale con datos vacíos o directamente rechazada
   * (`POST /orders` valida la dirección de origen).
   */
  | 'requerida_para_operar'
  /** Tiene default o es un override. */
  | 'opcional';

export type CorreoEnvGroup =
  | 'paqar'
  | 'micorreo'
  | 'remitente'
  | 'origen'
  | 'producto'
  | 'fallback'
  /**
   * Flags de operación. No son credenciales ni datos del envío: prenden y apagan
   * automatismos (auto-fulfillment, sync de tracking) y deciden quién genera el
   * tracking number. Se leen FUERA del loader —en el subscriber, el job y el
   * workflow, con `env` inyectado— y por eso se escaparon del catálogo hasta que
   * el test guard empezó a escanear esas carpetas.
   */
  | 'operacion'
  | 'seeds';

export interface CorreoSettingStatus {
  /** El NOMBRE de la clave. Nunca su valor. */
  name: string;
  /**
   * Qué capa aportó el valor efectivo. Es el dato que reemplazó al viejo booleano
   * de presencia de env: "está cargada" sin decir DÓNDE no le sirve a nadie en
   * multitienda, porque la respuesta correcta a "no anda" depende de si la tienda
   * tiene lo suyo, si está heredando de la global o si está en fail-closed.
   */
  source: CorreoSettingSource;
  /**
   * ¿Hay valor efectivo? Equivale a `source` distinto de `off` y de `unset`.
   *
   * Es el sucesor honesto del viejo `present`, y se llama distinto A PROPÓSITO:
   * quien lea `configured` no puede confundirlo con "existe la env var", que era
   * lo que el campo anterior medía y lo que dejó de ser cierto.
   */
  configured: boolean;
  /**
   * ¿El normalizador del módulo lo ACEPTA?
   *
   * `configured: true` + `usable: false` es el caso más traicionero de todos: el
   * valor está cargado y el módulo lo descarta en silencio. Pasa con
   * `CORREO_ARGENTINO_API_KEY` cuando se copió la celda de la planilla de Correo
   * con el prefijo `"Apikey "` y nada más, y con `CORREO_ARGENTINO_EXT_CLIENT`
   * cuando no son exactamente 3 dígitos.
   */
  usable: boolean;
  requirement: CorreoEnvRequirement;
  group: CorreoEnvGroup;
}

/** A dónde apunta la integración, sin ecoar el hostname configurado. */
export type CorreoTarget = 'test' | 'prod' | 'custom';

/**
 * Target de CADA API. Pueden diferir: `CORREO_ARGENTINO_MICORREO_HOSTNAME`
 * desacopla el host de MiCorreo del de paqar (operar en test y cotizar en prod es
 * un escenario real). Igual que `target`, son CLASIFICADORES, nunca el valor.
 */
export interface CorreoTargets {
  paqar: CorreoTarget;
  micorreo: CorreoTarget;
}

export interface CorreoConfigReport {
  settings: CorreoSettingStatus[];
  /** `requerida` sin valor usable. */
  missing_required: string[];
  /** `requerida_para_cotizar` sin valor usable. */
  missing_quoting: string[];
  /** `requerida_para_operar` sin valor usable. */
  missing_operating: string[];
  /** ¿Se puede llamar a paqar? (apiKey + agreement usables) */
  paqar_ready: boolean;
  /** ¿Se puede llamar a MiCorreo? (user + pass + customerId usables) */
  micorreo_ready: boolean;
  /**
   * `test` → `apitest.correoargentino.com.ar`, `prod` → `api…`, `custom` → el host
   * configurado no es ninguno de los dos. Se devuelve el CLASIFICADOR y no el
   * hostname para no ecoar el valor.
   *
   * Es el target de **paqar**. Se conserva porque es el que consume el admin y
   * porque en la instalación default las dos APIs apuntan al mismo lado; cuando
   * pueden diferir, el dato completo está en `targets`.
   */
  target: CorreoTarget;
  /** Target por API. `targets.paqar === target` siempre. */
  targets: CorreoTargets;
}

/* -------------------------------------------------------------------------- */
/* Entrada                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Lo que este archivo necesita saber de UNA clave: qué capa ganó y qué valor.
 *
 * El valor entra en claro —incluidos los secretos descifrados— porque sin él no se
 * puede contestar `usable`, que es la mitad del diagnóstico. NUNCA se copia al
 * reporte: lo único que sale de acá es el booleano que devuelve el normalizador.
 * Esa es la frontera, y el primer test del archivo la vigila.
 */
export type CorreoResolvedSetting = {
  source: SettingSource;
  value: unknown;
};

export type CorreoReportInput = {
  /**
   * Estado + valor efectivo por CLAVE, tal como salen de `getStates()` y
   * `resolveMany()` para la tienda de la request. Una clave del catálogo que no
   * esté acá cae al entorno (es el caso de las dos `envOnly`, que no tienen
   * descriptor).
   */
  settings: Record<string, CorreoResolvedSetting>;
  /**
   * Las credenciales que la tienda cargó en `site_credential`, si tiene. PISAN a
   * lo que haya resuelto el descriptor, así que una clave que venga de acá se
   * reporta con `source: 'credential'`.
   */
  siteCredentials?: CorreoSiteCredentials | null;
  /** `process.env`. Sólo para las claves del catálogo que no tienen descriptor. */
  env?: EnvLike;
};

/**
 * Qué clave de `site_credential` alimenta a qué clave del catálogo.
 *
 * Es el mismo mapeo que hace `applyCorreoSiteCredentials()` sobre las options, en
 * la única otra dirección en que se necesita. Vive acá y no en el route porque es
 * un dato del REPORTE —"esta clave puede venir de la otra capa"— y porque tenerlo
 * al lado del catálogo es lo que hace evidente cuál falta si mañana se agrega una
 * credencial nueva.
 */
const CREDENTIAL_KEYS: Readonly<Record<keyof CorreoSiteCredentials, string>> = {
  apiKey: 'CORREO_ARGENTINO_API_KEY',
  agreement: 'CORREO_ARGENTINO_AGREEMENT',
  sellerId: 'CORREO_ARGENTINO_SELLER_ID',
  micorreoUser: 'CORREO_ARGENTINO_MICORREO_USER',
  micorreoPassword: 'CORREO_ARGENTINO_MICORREO_PASS',
  customerId: 'CORREO_ARGENTINO_CUSTOMER_ID',
};

/* -------------------------------------------------------------------------- */
/* Catálogo                                                                    */
/* -------------------------------------------------------------------------- */

/** Un valor efectivo, visto como string. `undefined` = no hay valor. */
function asText(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : undefined;
  if (typeof value !== 'string') return undefined;
  return value.trim().length > 0 ? value : undefined;
}

interface SettingSpec {
  name: string;
  requirement: CorreoEnvRequirement;
  group: CorreoEnvGroup;
  /**
   * Normalizador del módulo, para las claves que pueden tener valor y ser
   * descartadas igual. Ausente = `usable === configured`.
   */
  normalize?: (value: string | undefined) => string | undefined;
}

/**
 * Catálogo de las claves de Correo.
 *
 * Orden: primero lo que rompe la integración entera, después lo que rompe la
 * cotización, después lo que rompe el alta, y al final lo cosmético. Es el orden
 * en que conviene leerlas cuando algo no anda.
 */
const CORREO_SETTINGS: readonly SettingSpec[] = [
  // ── paqar: operar ──
  {
    name: 'CORREO_ARGENTINO_API_KEY',
    requirement: 'requerida',
    group: 'paqar',
    // La planilla de Correo trae la celda con el prefijo `"Apikey "` puesto y el
    // cliente lo agrega de nuevo: el loader lo saca. Un valor que sea SOLO el
    // prefijo queda vacío → con valor pero inservible.
    normalize: normalizeApiKey,
  },
  {
    name: 'CORREO_ARGENTINO_AGREEMENT',
    requirement: 'requerida',
    group: 'paqar',
  },
  {
    name: 'CORREO_ARGENTINO_SELLER_ID',
    requirement: 'opcional',
    group: 'paqar',
  },
  {
    name: 'CORREO_ARGENTINO_TEST_MODE',
    requirement: 'opcional',
    group: 'paqar',
  },
  {
    name: 'CORREO_ARGENTINO_HOSTNAME',
    requirement: 'opcional',
    group: 'paqar',
  },
  {
    // Override del path base de paqar. Existe porque Correo YA movió la URL: el
    // manual v1 apuntaba a `/apipaqar` y el changelog documenta la "inclusión
    // versión en la URL". Un `/paqar/v2` tiene que ser un cambio de configuración.
    name: 'CORREO_ARGENTINO_PAQAR_BASE_PATH',
    requirement: 'opcional',
    group: 'paqar',
  },
  {
    name: 'CORREO_ARGENTINO_EXT_CLIENT',
    requirement: 'opcional',
    group: 'paqar',
    // EXACTAMENTE 3 dígitos o se descarta: mandarlo mal es peor que omitirlo.
    normalize: normalizeExtClient,
  },

  // ── MiCorreo: cotizar ──
  {
    name: 'CORREO_ARGENTINO_MICORREO_USER',
    requirement: 'requerida_para_cotizar',
    group: 'micorreo',
  },
  {
    name: 'CORREO_ARGENTINO_MICORREO_PASS',
    requirement: 'requerida_para_cotizar',
    group: 'micorreo',
  },
  {
    name: 'CORREO_ARGENTINO_CUSTOMER_ID',
    requirement: 'requerida_para_cotizar',
    group: 'micorreo',
  },
  {
    // Desacopla el host de MiCorreo del de paqar. Sin ella, MiCorreo usa
    // `CORREO_ARGENTINO_HOSTNAME` y, sin ese, el derivado de `TEST_MODE`.
    name: 'CORREO_ARGENTINO_MICORREO_HOSTNAME',
    requirement: 'opcional',
    group: 'micorreo',
  },
  {
    name: 'CORREO_ARGENTINO_MICORREO_BASE_PATH',
    requirement: 'opcional',
    group: 'micorreo',
  },

  // ── Origen: `POST /orders` lo valida ──
  {
    name: 'CORREO_ARGENTINO_ORIGIN_POSTAL_CODE',
    requirement: 'requerida_para_operar',
    group: 'origen',
  },
  {
    name: 'CORREO_ARGENTINO_ORIGIN_STREET',
    requirement: 'requerida_para_operar',
    group: 'origen',
  },
  {
    name: 'CORREO_ARGENTINO_ORIGIN_NUMBER',
    requirement: 'requerida_para_operar',
    group: 'origen',
  },
  {
    name: 'CORREO_ARGENTINO_ORIGIN_CITY',
    requirement: 'requerida_para_operar',
    group: 'origen',
  },
  {
    name: 'CORREO_ARGENTINO_ORIGIN_STATE',
    requirement: 'requerida_para_operar',
    group: 'origen',
  },
  {
    name: 'CORREO_ARGENTINO_ORIGIN_FLOOR',
    requirement: 'opcional',
    group: 'origen',
  },
  {
    name: 'CORREO_ARGENTINO_ORIGIN_DEPARTMENT',
    requirement: 'opcional',
    group: 'origen',
  },

  // ── Remitente ──
  {
    // Tiene default (`"Remitente"`), así que NO bloquea el alta — pero un envío
    // real con ese nombre es un problema operativo, no un default razonable.
    name: 'CORREO_ARGENTINO_SENDER_NAME',
    requirement: 'requerida_para_operar',
    group: 'remitente',
  },
  {
    name: 'CORREO_ARGENTINO_SENDER_EMAIL',
    requirement: 'opcional',
    group: 'remitente',
  },
  {
    name: 'CORREO_ARGENTINO_SENDER_PHONE',
    requirement: 'opcional',
    group: 'remitente',
  },
  {
    name: 'CORREO_ARGENTINO_SENDER_CELLPHONE',
    requirement: 'opcional',
    group: 'remitente',
  },
  {
    name: 'CORREO_ARGENTINO_SENDER_OBSERVATION',
    requirement: 'opcional',
    group: 'remitente',
  },

  // ── Producto y límites ──
  {
    name: 'CORREO_ARGENTINO_SERVICE_TYPE',
    requirement: 'opcional',
    group: 'producto',
  },
  {
    name: 'CORREO_ARGENTINO_PRODUCT_CATEGORY',
    requirement: 'opcional',
    group: 'producto',
  },
  {
    name: 'CORREO_ARGENTINO_PRODUCT_WEIGHT_UNIT',
    requirement: 'opcional',
    group: 'producto',
  },
  {
    name: 'CORREO_ARGENTINO_MAX_WEIGHT_G',
    requirement: 'opcional',
    group: 'producto',
  },
  {
    name: 'CORREO_ARGENTINO_MAX_DIMENSION_CM',
    requirement: 'opcional',
    group: 'producto',
  },
  {
    name: 'CORREO_ARGENTINO_AFORO_DIVISOR',
    requirement: 'opcional',
    group: 'producto',
  },

  // ── Fallback de dimensiones (opt-in) ──
  {
    name: 'CORREO_ARGENTINO_DIMENSION_FALLBACK_ENABLED',
    requirement: 'opcional',
    group: 'fallback',
  },
  {
    name: 'CORREO_ARGENTINO_DIMENSION_FALLBACK_LENGTH',
    requirement: 'opcional',
    group: 'fallback',
  },
  {
    name: 'CORREO_ARGENTINO_DIMENSION_FALLBACK_WIDTH',
    requirement: 'opcional',
    group: 'fallback',
  },
  {
    name: 'CORREO_ARGENTINO_DIMENSION_FALLBACK_HEIGHT',
    requirement: 'opcional',
    group: 'fallback',
  },
  {
    name: 'CORREO_ARGENTINO_DIMENSION_FALLBACK_WEIGHT',
    requirement: 'opcional',
    group: 'fallback',
  },

  // ── Operación: automatismos y decisión del TN ──
  // Todas son opt-in con default seguro, así que faltar NO es un problema — pero el
  // health check tiene que poder decir si están prendidas, porque explican
  // comportamiento.
  {
    // `true` → al pagar, el subscriber crea el fulfillment NATIVO de Medusa.
    // Ausente = nada automático. OJO: no crea el envío en Correo.
    name: 'CORREO_ARGENTINO_AUTO_FULFILL',
    requirement: 'opcional',
    group: 'operacion',
  },
  {
    // Base de la URL pública de seguimiento que se le muestra al comprador.
    // Es una página web, no una API: si está mal, el síntoma es un link roto.
    name: 'CORREO_ARGENTINO_TRACKING_BASE_URL',
    requirement: 'opcional',
    group: 'operacion',
  },
  {
    // ENV-ONLY: Medusa hornea el cron al arrancar (`job-loader.js:69-78`), así que
    // no tiene descriptor y su único origen posible es el entorno.
    name: 'CORREO_ARGENTINO_TRACKING_SYNC_SCHEDULE',
    requirement: 'opcional',
    group: 'operacion',
  },
  {
    // `true` → el job solo sincroniza entre las 8 y las 21 ART. Ausente = siempre.
    name: 'CORREO_ARGENTINO_TRACKING_BUSINESS_HOURS_ONLY',
    requirement: 'opcional',
    group: 'operacion',
  },
  {
    // ⚠️ Dejarla APAGADA hasta que Correo confirme por escrito el formato pactado
    // del TN propio: un formato no pactado puede ser rechazado (o aceptado hoy y
    // rechazado cuando endurezcan la validación), y una colisión dentro del
    // agreement es IRRECUPERABLE. Ausente = el TN lo genera Correo.
    name: 'CORREO_ARGENTINO_SELF_GENERATED_TN',
    requirement: 'opcional',
    group: 'operacion',
  },
  {
    // Prefijo del TN propio. Default `MER`. Solo aplica con SELF_GENERATED_TN.
    name: 'CORREO_ARGENTINO_TN_PREFIX',
    requirement: 'opcional',
    group: 'operacion',
  },

  // ── Seeds ──
  {
    // ENV-ONLY: la leen los scripts de seed, que corren por CLI sin contenedor.
    name: 'CORREO_ARGENTINO_SEED_SHIPPING_OPTIONS',
    requirement: 'opcional',
    group: 'seeds',
  },
];

/** Los nombres del catálogo, para tests y para documentar la ruta. */
export const CORREO_ENV_VAR_NAMES: readonly string[] = CORREO_SETTINGS.map(
  (spec) => spec.name
);

/* -------------------------------------------------------------------------- */
/* Target                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Los tres valores EFECTIVOS que deciden a qué servidor le pega cada API.
 *
 * Entran como valores ya resueltos y no como env vars porque el host puede venir
 * de la fila de la instancia: clasificar `process.env` diría "prod" en una
 * instalación que tiene `apitest…` guardado en la base, que es el mismo falso
 * negativo que este archivo vino a matar, pero al revés y más caro.
 */
export type CorreoTargetValues = {
  hostname?: unknown;
  micorreoHostname?: unknown;
  testMode?: unknown;
};

/**
 * A dónde apunta **paqar**, que es el target de la integración en la instalación
 * default (las dos APIs comparten host si nadie las separa).
 */
export function resolveCorreoTarget(values: CorreoTargetValues): CorreoTarget {
  return resolveCorreoTargets(values).paqar;
}

/**
 * Target de las DOS APIs. La cadena de fallback es la misma que la del módulo:
 * `micorreoHostname` → `hostname` → derivado de `testMode`, así que sin el override
 * propio los dos targets coinciden.
 *
 * Los hostnames se clasifican con `normalizeHostname()` — el mismo normalizador del
 * loader — para que un `https://api.correoargentino.com.ar` pegado en el campo se
 * reporte como `prod` y no como `custom`. Se devuelve el CLASIFICADOR y nunca el
 * host, que es un valor como cualquier otro.
 */
export function resolveCorreoTargets(values: CorreoTargetValues): CorreoTargets {
  // Mismo criterio que `readBool()` del loader: sólo `true` (o el string "true")
  // es modo de prueba. La base guarda booleanos ya tipados y el entorno strings.
  const raw = asText(values.testMode)?.trim().toLowerCase();
  const fromTestMode: CorreoTarget = raw === 'true' ? 'test' : 'prod';

  const classify = (value: unknown): CorreoTarget | undefined => {
    const hostname = normalizeHostname(asText(value));
    if (!hostname) return undefined;
    if (hostname === CORREO_TEST_HOSTNAME) return 'test';
    if (hostname === CORREO_PROD_HOSTNAME) return 'prod';
    return 'custom';
  };

  const paqar = classify(values.hostname) ?? fromTestMode;

  return {
    paqar,
    micorreo: classify(values.micorreoHostname) ?? paqar,
  };
}

/* -------------------------------------------------------------------------- */
/* Reporte                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Arma el reporte de configuración.
 *
 * `paqar_ready` mira `usable` y no `configured` a propósito: una API-Key que el
 * normalizador descarta deja al cliente sin poder autenticar igual que una ausente,
 * así que decir "lista" porque hay un valor mandaría la sonda a fallar con un 401
 * en vez de reportar el problema real.
 */
export function buildCorreoConfigReport(input: CorreoReportInput): CorreoConfigReport {
  const { settings: resolved, siteCredentials, env = {} } = input;

  /** Las claves que la tienda pisó con su credencial propia. */
  const fromCredential = new Map<string, string>();
  for (const [field, key] of Object.entries(CREDENTIAL_KEYS)) {
    const value = siteCredentials?.[field as keyof CorreoSiteCredentials];
    if (typeof value === 'string' && value.trim().length > 0) {
      fromCredential.set(key, value);
    }
  }

  /**
   * El estado de UNA clave, en el orden en que manda la realidad:
   *
   *  1. `site_credential`, que pisa a todo (`applyCorreoSiteCredentials`).
   *  2. la resolución del descriptor, con la precedencia de la decisión 3.
   *  3. el entorno pelado, para las dos claves que no tienen descriptor.
   */
  const stateOf = (name: string): { source: CorreoSettingSource; value: unknown } => {
    const credential = fromCredential.get(name);
    if (credential !== undefined) return { source: 'credential', value: credential };

    const entry = resolved[name];
    if (entry) return { source: entry.source, value: entry.value };

    const raw = env[name];
    return asText(raw) !== undefined
      ? { source: 'env', value: raw }
      : { source: 'unset', value: undefined };
  };

  const settings: CorreoSettingStatus[] = CORREO_SETTINGS.map((spec) => {
    const { source, value } = stateOf(spec.name);
    const text = asText(value);
    const configured = text !== undefined;
    return {
      name: spec.name,
      source,
      configured,
      usable: spec.normalize ? asText(spec.normalize(text)) !== undefined : configured,
      requirement: spec.requirement,
      group: spec.group,
    };
  });

  const missingBy = (requirement: CorreoEnvRequirement): string[] =>
    settings
      .filter((entry) => entry.requirement === requirement && !entry.usable)
      .map((entry) => entry.name);

  const usable = (name: string): boolean =>
    settings.find((entry) => entry.name === name)?.usable === true;

  const targets = resolveCorreoTargets({
    hostname: stateOf('CORREO_ARGENTINO_HOSTNAME').value,
    micorreoHostname: stateOf('CORREO_ARGENTINO_MICORREO_HOSTNAME').value,
    testMode: stateOf('CORREO_ARGENTINO_TEST_MODE').value,
  });

  return {
    settings,
    missing_required: missingBy('requerida'),
    missing_quoting: missingBy('requerida_para_cotizar'),
    missing_operating: missingBy('requerida_para_operar'),
    paqar_ready:
      usable('CORREO_ARGENTINO_API_KEY') && usable('CORREO_ARGENTINO_AGREEMENT'),
    micorreo_ready:
      usable('CORREO_ARGENTINO_MICORREO_USER') &&
      usable('CORREO_ARGENTINO_MICORREO_PASS') &&
      usable('CORREO_ARGENTINO_CUSTOMER_ID'),
    target: targets.paqar,
    targets,
  };
}
