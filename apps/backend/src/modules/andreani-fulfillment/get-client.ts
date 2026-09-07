/**
 * Clientes de Andreani para los caminos que corren FUERA del provider de
 * fulfillment (workflow de tickets, job de tracking, descarga de rótulos, rutas
 * custom de admin/store), donde Medusa no inyecta las options del provider.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ HAY DOS FAMILIAS Y ELEGIR MAL TIENE CONSECUENCIA CONTABLE.                │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 *  - `getAndreaniClient(logger)` / `getAndreaniTransformer()` — configuración de
 *    la INSTANCIA. Para lo que no depende de una tienda: consultas de puntos de
 *    retiro, tracking público, y los call sites que todavía no tienen de dónde
 *    sacar la tienda.
 *
 *  - `getAndreaniContextForSite(container, hint, logger)` — configuración de LA
 *    TIENDA de esa orden o ese carrito. Para TODO lo que cotice, dé de alta un
 *    envío o emita una etiqueta.
 *
 * El bug que motivó la segunda familia: la cotización
 * (`service.ts:calculatePrice` vía `clientForChannel`) ya resolvía las
 * credenciales por tienda, pero el ALTA DEL ENVÍO
 * (`workflows/andreani-generate-tickets.ts:413`) construía su cliente con
 * `getAndreaniClient(logger)`, o sea con el entorno. Una tienda cotizaba con su
 * cuenta y despachaba con la de la instancia: el envío salía igual y se le
 * facturaba al titular equivocado, sin un solo error.
 */

import type { Logger, MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { resolveSite } from '../../lib/multistore/resolve-site';
import { readSiteCredentials } from '../../lib/multistore/credentials';
import type { SiteHint, SiteResolution } from '../../lib/multistore/types';
import AndreaniClient from './client';
import {
  applyAndreaniSiteCredentials,
  resolveContractForService,
  type AndreaniSiteCredentials,
} from './env-options';
import {
  credentialsFingerprint,
  getAndreaniSettings,
  hasAndreaniCredentials,
  loadAndreaniSettingsViaPg,
  type AndreaniSettings,
  type PgRawConnection,
} from './settings';
import { AndreaniDataTransformer } from './transformers/data-transformer';
import type { AndreaniProviderOptions, AndreaniServiceType } from './types';

type MinimalLogger = Pick<Logger, 'info' | 'warn' | 'error' | 'debug'>;

/**
 * La integración tal como la nombra `site_credential` (`catalog.ts:46`).
 *
 * `service.ts` repite el LITERAL en vez de importar esto, a propósito: el guard de
 * `catalog.test.ts` grepea el archivo del lector y una constante importada lo deja
 * ciego. Que los dos coincidan lo verifica `site-credentials.test.ts`.
 */
export const ANDREANI_CREDENTIAL_INTEGRATION = 'andreani';

export type AndreaniContext = {
  client: AndreaniClient;
  transformer: AndreaniDataTransformer;
  /** Ya con las credenciales de la tienda aplicadas encima, si las tiene. */
  options: AndreaniProviderOptions;
  settings: AndreaniSettings;
  /** El contrato de ese servicio, con el override de ESTA tienda. */
  contractFor: (serviceType: AndreaniServiceType) => string;
  /** De dónde salieron las credenciales. Sirve para loguear sin filtrarlas. */
  credentialSource: 'site' | 'instance';
  /** `false` = falta usuario, contraseña o contrato. El caller decide si corta. */
  configured: boolean;
};

/* -------------------------------------------------------------------------- */
/* Cache de clientes por HUELLA, no por tiempo                                 */
/* -------------------------------------------------------------------------- */

/**
 * `AndreaniClient` cachea el token ~23 h en la instancia (`client.ts:44-46`) y
 * Andreani tiene rate limit propio (`AndreaniRateLimitError`, `client.ts:334`). Un
 * cliente nuevo por cotización sería un `GET /login` por cotización: en el pico de
 * un checkout eso es un 429 esperando a pasar.
 *
 * Por eso se cachea POR HUELLA de las credenciales y no por TTL. Con TTL, cada
 * expiración tira un token que todavía valía; con huella, el cliente sobrevive
 * mientras las credenciales no cambien y se reconstruye SOLO cuando cambian —que es
 * exactamente cuando el token deja de servir. Mismo criterio que
 * `typesense/service.ts:clientFingerprint`.
 *
 * El tope existe porque la huella incluye la tienda: con N tiendas el mapa crece
 * hasta N, y no queremos que una instancia con cientos de tiendas acumule cientos de
 * clientes con sus tokens. Se desaloja el MENOS USADO RECIENTEMENTE (`Map` conserva
 * el orden de inserción y cada acierto reinserta), que en este caso es la tienda que
 * hace más tiempo que no despacha.
 */
const CLIENT_CACHE_MAX = 32;
const clientCache = new Map<string, AndreaniClient>();

/** Sólo para tests. */
export function __resetAndreaniClientCache(): void {
  clientCache.clear();
}

export function getCachedAndreaniClient(
  options: AndreaniProviderOptions,
  logger: MinimalLogger,
): AndreaniClient {
  const key = credentialsFingerprint(options);

  const cached = clientCache.get(key);
  if (cached) {
    // Reinserción = "usado recién". Es lo que convierte el orden del Map en LRU.
    clientCache.delete(key);
    clientCache.set(key, cached);
    return cached;
  }

  const client = new AndreaniClient(options, logger);
  clientCache.set(key, client);
  if (clientCache.size > CLIENT_CACHE_MAX) {
    const oldest = clientCache.keys().next();
    if (!oldest.done) clientCache.delete(oldest.value);
  }
  return client;
}

/* -------------------------------------------------------------------------- */
/* Contextos                                                                   */
/* -------------------------------------------------------------------------- */

function contextFor(
  settings: AndreaniSettings,
  options: AndreaniProviderOptions,
  credentialSource: 'site' | 'instance',
  logger: MinimalLogger,
): AndreaniContext {
  return {
    client: getCachedAndreaniClient(options, logger),
    transformer: new AndreaniDataTransformer(options),
    options,
    settings,
    contractFor: (serviceType) =>
      resolveContractForService(serviceType, options.contract, settings.contractOverrides),
    credentialSource,
    configured: hasAndreaniCredentials(options),
  };
}

/** Contexto de la INSTANCIA. Sincrónico: no toca la base más allá del snapshot. */
export function getAndreaniContext(logger: MinimalLogger): AndreaniContext {
  const settings = getAndreaniSettings();
  return contextFor(settings, settings.options, 'instance', logger);
}

/** Cliente con la configuración de la instancia. Se mantiene por compatibilidad. */
export function getAndreaniClient(logger: MinimalLogger): AndreaniClient {
  return getAndreaniContext(logger).client;
}

/**
 * Transformer con la configuración de la instancia, para las rutas custom que no
 * pueden resolver el provider desde el request container.
 *
 * Lee de `getAndreaniSettings()` y ya NO de `loadAndreaniOptionsFromEnv()`: si no,
 * el operador cambiaba el origen desde el admin y estas rutas seguían armando el
 * payload con el del `.env`.
 */
export function getAndreaniTransformer(): AndreaniDataTransformer {
  return new AndreaniDataTransformer(getAndreaniSettings().options);
}

const pgOf = (container: MedusaContainer): PgRawConnection | undefined => {
  try {
    return container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as unknown as PgRawConnection;
  } catch {
    return undefined;
  }
};

/**
 * Contexto con la configuración y las credenciales de la tienda que resuelva `hint`.
 *
 * Tres capas, en este orden:
 *
 *  1. `site_setting` — configuración (origen, remitente, contratos por servicio,
 *     bultos), con la precedencia de la decisión 3 y su fail-closed.
 *  2. `site_credential` — las cuatro credenciales, cifradas con OTRA clave.
 *  3. El resultado se combina con `applyAndreaniSiteCredentials`, no con un spread.
 *
 * Manejo de errores, calcado del provider (`service.ts:clientForChannel`) porque la
 * decisión es la misma:
 *
 *  - Blob de credenciales ILEGIBLE (típicamente porque rotó `JWT_SECRET`) → TIRA. La
 *    tienda declaró credenciales propias; usar las de la instancia sería despachar y
 *    facturar contra otro titular, y el envío sale igual. Vale más fallar.
 *  - Cualquier otro fallo de LECTURA → degrada al contexto de la instancia con un
 *    warn. Dejar la operación sin despachar porque la base parpadeó es peor que usar
 *    lo que se venía usando.
 */
export async function getAndreaniContextForSite(
  container: MedusaContainer,
  hint: SiteHint,
  logger: MinimalLogger,
): Promise<AndreaniContext> {
  try {
    const resolution: SiteResolution = await resolveSite(container, hint);
    const settings = await loadAndreaniSettingsViaPg(pgOf(container), resolution);

    const creds = await readSiteCredentials<AndreaniSiteCredentials>(
      container,
      ANDREANI_CREDENTIAL_INTEGRATION,
      resolution,
    );

    if (creds.status === 'missing' && creds.reason === 'undecryptable') {
      throw new Error(
        'Las credenciales de Andreani de esta tienda no se pueden descifrar ' +
          '(probablemente rotó JWT_SECRET). Volvé a cargarlas antes de despachar.',
      );
    }

    if (creds.status === 'found' && creds.source === 'site') {
      return contextFor(
        settings,
        applyAndreaniSiteCredentials(settings.options, creds.value),
        'site',
        logger,
      );
    }

    return contextFor(settings, settings.options, 'instance', logger);
  } catch (error) {
    if (error instanceof Error && error.message.includes('no se pueden descifrar')) throw error;
    logger.warn(
      `[andreani] No se pudo resolver la configuración por tienda: ${
        error instanceof Error ? error.message : String(error)
      }. Se usa la de la instancia.`,
    );
    return getAndreaniContext(logger);
  }
}

/**
 * Atajo cuando ya se tiene el id de la tienda y sólo hace falta el cliente.
 *
 * Con `siteId` nulo o vacío, `resolveSite` cae a `allSites`/`singleSite` y el
 * contexto es el de la instancia — o sea, el comportamiento de antes. Los callers
 * que tienen una orden o un carrito conviene que usen `getAndreaniContextForSite`
 * con `{ orderId }` / `{ salesChannelId }`, que son pistas más fuertes.
 */
export async function getAndreaniClientForSite(
  container: MedusaContainer,
  siteId: string | null | undefined,
  logger: MinimalLogger,
): Promise<AndreaniClient> {
  const context = await getAndreaniContextForSite(container, { siteId: siteId ?? null }, logger);
  return context.client;
}
