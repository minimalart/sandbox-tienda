/**
 * Admin API — health check de la integración de Correo Argentino.
 *
 * GET /admin/correo-argentino/health            → solo estado de configuración
 * GET /admin/correo-argentino/health?probe=true → + sonda real contra las DOS APIs
 *
 * Responde DOS cosas:
 *
 *  (a) El **estado de configuración** de las claves de Correo: de qué capa sale
 *      cada una y si el módulo la acepta. ⚠️ Sólo nombres, orígenes y booleanos: el
 *      valor de un ajuste NUNCA sale de acá (ver `_env-report.ts`).
 *  (b) El resultado de la **sonda de conexión** contra paqar (`GET /auth`) y
 *      contra MiCorreo (`POST /token` + `POST /rates`).
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ LAS DOS MITADES MIRAN LA MISMA TIENDA. NO ES UN DETALLE.                 │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * La tienda sale de `siteFromRequest` (el header `x-site-id` que cuelga el
 * middleware de `/admin/*`) y viaja a las DOS: el reporte se arma con `getStates`
 * para esa tienda y la sonda construye sus clientes con `getCorreoClientsForSite`
 * para esa misma tienda. Reportar la configuración de la tienda B y sondear con la
 * cuenta de la instancia sería un health check que se contradice solo, y el
 * operador no tendría forma de saber cuál de las dos mitades le está mintiendo.
 *
 * Antes de la migración a `app-settings` esto no se podía plantear: la
 * configuración era el `.env` del proceso y no tenía eje de tienda. Por eso la
 * entrada de esta ruta en `scoped-routes.ts` decía `not-applicable`; hoy dice
 * `scoped`, que es lo que efectivamente hace.
 *
 * Tres decisiones de diseño que no son gratuitas:
 *
 *  1. **La sonda es OPT-IN por `?probe=true`.** Sin el param esta ruta no toca la
 *     red. La página de configuración se monta cada vez que alguien navega ahí y
 *     no queremos pegarle al gateway de Correo (ni gastar cuota del acuerdo) en
 *     cada render. La llamada la dispara una persona apretando un botón.
 *  2. **Nunca un 500 por una sonda que falla.** La ruta responde 200 con el
 *     diagnóstico adentro. El operador necesita leer "las credenciales están mal"
 *     o "el gateway no responde"; un stack trace con status 500 lo único que le
 *     dice es que algo se rompió, y encima parece un bug nuestro.
 *  3. **Si faltan las credenciales obligatorias no se intenta la llamada**: se
 *     devuelve `sin_credenciales`, que es la verdad, en vez de un error de red
 *     confuso a nombre de Correo.
 *
 * ⚠️ Ninguna de las dos sondas se ejercitó nunca contra la API real de Correo: no
 * hay credenciales. Esta ruta es precisamente la herramienta que va a permitir
 * verificarlo el día que lleguen.
 */

import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import type { Logger, MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { siteFromRequest } from '../../../../lib/multistore/request';
import type { SiteResolution } from '../../../../lib/multistore/types';
import correoDescriptors from '../../../../modules/app-settings/descriptors/correo-argentino';
import {
  getStates,
  resolveMany,
  siteScopeIdOf,
} from '../../../../modules/app-settings/service';
import {
  getCorreoClientsForSite,
  getCorreoPaqarClientForSite,
} from '../../../../modules/correo-argentino-fulfillment/get-client';
import {
  isUndecryptableCredentialsError,
  readCorreoSiteCredentials,
  type CorreoSiteCredentials,
} from '../../../../modules/correo-argentino-fulfillment/site-credentials';
import { extractErrorMessage } from '../../../../modules/correo-argentino-fulfillment/utils/errors';
import { parseOptionalBoolean } from '../_input';
import {
  buildCorreoConfigReport,
  type CorreoConfigReport,
  type CorreoResolvedSetting,
} from './_env-report';
import {
  classifyCorreoProbeError,
  classifyMiCorreoRatesResult,
  classifyPaqarAuthStatus,
  CORREO_PROBE_DESTINATION_POSTAL_CODE,
  CORREO_PROBE_FALLBACK_ORIGIN_POSTAL_CODE,
  CORREO_PROBE_PARCEL,
  credentialsMissingOutcome,
  notProbedOutcome,
  type CorreoMiCorreoProbeStatus,
  type CorreoProbeOutcome,
  type CorreoProbeStatus,
} from './_probe';

type MinimalLogger = Pick<Logger, 'info' | 'warn' | 'error' | 'debug'>;

interface CorreoHealthResponse {
  checked_at: string;
  /** ¿Se pidió la sonda? `false` = nada de esta respuesta tocó la red. */
  probe_requested: boolean;
  /** La capa que se está mirando. `null` = la configuración de la instancia. */
  site_id: string | null;
  config: CorreoConfigReport;
  /**
   * La tienda tiene credenciales propias y su blob NO se puede descifrar
   * (típicamente porque rotó `JWT_SECRET`). Es el ÚNICO estado en que el reporte
   * está incompleto a sabiendas: el módulo va a tirar en vez de despachar, así que
   * decir "todo verde" porque el descriptor tiene valores sería la peor mentira
   * posible de esta pantalla.
   */
  credentials_unreadable: boolean;
  paqar: CorreoProbeOutcome<CorreoProbeStatus>;
  micorreo: CorreoProbeOutcome<CorreoMiCorreoProbeStatus> & {
    /**
     * CP de destino de la sonda. Es una constante de NUESTRO código, no un ajuste,
     * así que se puede mostrar.
     */
    probe_destination_postal_code: string;
    /**
     * ¿La sonda usó el CP de origen configurado? `false` = se usó el de respaldo
     * porque `CORREO_ARGENTINO_ORIGIN_POSTAL_CODE` no tiene valor efectivo. El CP
     * configurado NO se devuelve: es un valor.
     */
    probe_used_configured_origin: boolean;
  };
}

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);

  const resolution = await siteFromRequest(req);
  const siteId = siteScopeIdOf(resolution);

  const credentials = await readSiteCredentials(req.scope, resolution, logger);
  const config = await buildReport(req.scope, resolution, credentials.value);

  const probeRequested = parseOptionalBoolean(req.query.probe) === true;

  let paqar: CorreoProbeOutcome<CorreoProbeStatus> = notProbedOutcome();
  let micorreo: CorreoProbeOutcome<CorreoMiCorreoProbeStatus> =
    notProbedOutcome();
  let usedConfiguredOrigin = false;

  if (probeRequested) {
    // En paralelo: son dos APIs independientes y la sonda de MiCorreo son dos
    // llamadas encadenadas. Secuencial, el peor caso sumaría tres timeouts de
    // 12 s y el operador se quedaría mirando un spinner 36 s.
    const [paqarResult, micorreoResult] = await Promise.all([
      probePaqar(req.scope, siteId, logger, config),
      probeMiCorreo(req.scope, siteId, logger, config),
    ]);

    paqar = paqarResult;
    micorreo = micorreoResult.outcome;
    usedConfiguredOrigin = micorreoResult.usedConfiguredOrigin;

    logger.info(
      `[correo-health] Sonda: paqar=${paqar.status} micorreo=${micorreo.status} target=${config.target} site=${siteId ?? 'instancia'}`
    );
  }

  const body: CorreoHealthResponse = {
    checked_at: new Date().toISOString(),
    probe_requested: probeRequested,
    site_id: siteId,
    config,
    credentials_unreadable: credentials.unreadable,
    paqar,
    micorreo: {
      ...micorreo,
      probe_destination_postal_code: CORREO_PROBE_DESTINATION_POSTAL_CODE,
      probe_used_configured_origin: usedConfiguredOrigin,
    },
  };

  // Siempre 200: el diagnóstico ES la respuesta. Un fallo de la sonda no es un
  // fallo de este endpoint.
  res.status(200).json(body);
}

/* -------------------------------------------------------------------------- */
/* Estado de configuración                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Arma el reporte con la configuración EFECTIVA de la tienda de la request.
 *
 * Se piden las dos vistas del mismo namespace porque cada una contesta media
 * pregunta y ninguna puede contestar la otra:
 *
 *  - `getStates` da el ORIGEN, y con los secretos ya enmascarados. Es lo que puede
 *    viajar al browser.
 *  - `resolveMany` da el VALOR EN CLARO, que no sale de este proceso: entra sólo
 *    para que el normalizador del módulo diga si lo acepta. Sin él, una API-Key que
 *    es sólo el prefijo `"Apikey "` se reportaría como configurada y la sonda
 *    fallaría con un 401 sin explicación.
 *
 * No son dos viajes a Postgres: `getNamespaceRows` memoiza las filas por scope, así
 * que la segunda llamada relee el mismo jsonb.
 */
async function buildReport(
  container: MedusaContainer,
  resolution: SiteResolution,
  siteCredentials: CorreoSiteCredentials | null
): Promise<CorreoConfigReport> {
  const descriptors = correoDescriptors.settings;
  const [states, values] = await Promise.all([
    getStates(container, descriptors, resolution),
    resolveMany(container, descriptors, resolution),
  ]);

  const settings: Record<string, CorreoResolvedSetting> = {};
  for (const state of states) {
    settings[state.key] = { source: state.source, value: values[state.key] };
  }

  return buildCorreoConfigReport({ settings, siteCredentials, env: process.env });
}

/**
 * Las credenciales propias de la tienda, o `null` si hereda las de la instancia.
 *
 * Un blob ilegible NO tira acá: esta ruta es la herramienta de diagnóstico, así que
 * tiene que poder REPORTAR ese estado en vez de convertirse en el enésimo error sin
 * contexto. El módulo sí tira cuando le toca despachar, y con razón — despachar
 * contra la cuenta de otro titular es peor que fallar.
 */
async function readSiteCredentials(
  container: MedusaContainer,
  resolution: SiteResolution,
  logger: MinimalLogger
): Promise<{ value: CorreoSiteCredentials | null; unreadable: boolean }> {
  try {
    const pg = container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as never;
    return { value: await readCorreoSiteCredentials(pg, resolution), unreadable: false };
  } catch (error) {
    if (isUndecryptableCredentialsError(error)) {
      logger.warn(
        `[correo-health] Las credenciales de la tienda no se pueden descifrar: ${extractErrorMessage(error)}`
      );
      return { value: null, unreadable: true };
    }
    // Cualquier otra cosa (no hay registro de tiendas, no hay PG_CONNECTION) es el
    // caso normal de un proyecto mono-tienda: no hay capa de credenciales y punto.
    return { value: null, unreadable: false };
  }
}

/* -------------------------------------------------------------------------- */
/* Sondas                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * paqar: `GET /auth`.
 *
 * `probeAuth()` y no `testConnection()`: el booleano de `testConnection()` no
 * distingue una credencial inválida de un gateway caído, que son las dos únicas
 * conclusiones accionables.
 */
async function probePaqar(
  container: MedusaContainer,
  siteId: string | null,
  logger: MinimalLogger,
  config: CorreoConfigReport
): Promise<CorreoProbeOutcome<CorreoProbeStatus>> {
  if (!config.paqar_ready) {
    return credentialsMissingOutcome(config.missing_required);
  }

  try {
    // La construcción va DENTRO del try para que cualquier fallo salga como
    // diagnóstico y no como un 500: resolver la tienda toca Postgres y un blob de
    // credenciales ilegible TIRA a propósito. La sonda igual puede explotar por
    // DNS, TLS o timeout.
    const paqar = await getCorreoPaqarClientForSite(container, { siteId }, logger);
    return classifyPaqarAuthStatus(await paqar.probeAuth());
  } catch (error) {
    logger.error(
      `[correo-health] Sonda de paqar falló: ${extractErrorMessage(error)}`
    );
    return classifyCorreoProbeError(error);
  }
}

/**
 * MiCorreo: `POST /token` **y después** `POST /rates`.
 *
 * ⚠️ Los dos pasos, no uno. Una cuenta que Correo no activó comercialmente
 * autentica perfecto y devuelve `/rates` con 202 y `rates: []`: un health check
 * que se quedara en `/token` diría "todo bien" mientras el checkout cotiza $0 y
 * le muestra "Gratuito" al comprador en cada venta. El segundo paso es una SONDA
 * con datos dummy (CP de destino fijo, bulto chico bien dentro de los límites de
 * la API) cuyo único objetivo es ver si la cuenta devuelve tarifas.
 */
async function probeMiCorreo(
  container: MedusaContainer,
  siteId: string | null,
  logger: MinimalLogger,
  config: CorreoConfigReport
): Promise<{
  outcome: CorreoProbeOutcome<CorreoMiCorreoProbeStatus>;
  usedConfiguredOrigin: boolean;
}> {
  if (!config.micorreo_ready) {
    return {
      outcome: credentialsMissingOutcome(config.missing_quoting),
      usedConfiguredOrigin: false,
    };
  }

  let usedConfiguredOrigin = false;

  try {
    // `getCorreoClientsForSite` y no sólo el cliente: el paso 2 necesita también
    // las options resueltas, para el CP de origen.
    const { micorreo, options } = await getCorreoClientsForSite(
      container,
      { siteId },
      logger
    );

    // Paso 1: ¿autentica? El error sube tipado, con el status.
    await micorreo.probeAuth();

    // Paso 2: ¿cotiza? Es el paso que detecta la cuenta sin activar.
    const configuredOrigin = options.origin.postalCode?.trim();
    usedConfiguredOrigin = Boolean(configuredOrigin);
    const result = await micorreo.getRates({
      postalCodeOrigin:
        configuredOrigin || CORREO_PROBE_FALLBACK_ORIGIN_POSTAL_CODE,
      postalCodeDestination: CORREO_PROBE_DESTINATION_POSTAL_CODE,
      dimensions: { ...CORREO_PROBE_PARCEL },
    });

    return {
      outcome: classifyMiCorreoRatesResult(result),
      usedConfiguredOrigin,
    };
  } catch (error) {
    logger.error(
      `[correo-health] Sonda de MiCorreo falló: ${extractErrorMessage(error)}`
    );
    return {
      outcome: classifyCorreoProbeError(error),
      usedConfiguredOrigin,
    };
  }
}
