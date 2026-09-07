/**
 * Construye los clientes de Correo Argentino.
 *
 * Lo usan los caminos que corren FUERA del provider de fulfillment (workflow de
 * tickets, job de tracking, descarga de rótulos, rutas custom de admin/store),
 * donde Medusa no inyecta las options del provider.
 *
 * ⚠️ En rutas custom hay que construir el cliente ACÁ y NO resolver el provider
 * del `req.scope`: la resolución del provider desde el request container no es
 * confiable (mismo criterio que las rutas de Andreani).
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ HAY DOS VARIANTES Y ELEGIR MAL FACTURA EL FLETE EN LA CUENTA EQUIVOCADA. │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 *  - `getCorreoClientsForSite(container, hint, logger)` — ASÍNCRONA. Resuelve la
 *    configuración de LA TIENDA (`site_setting`) y sus credenciales
 *    (`site_credential`). Es la que hay que usar SIEMPRE que haya un contenedor.
 *  - `getCorreoClients(logger)` y sus dos primos de un solo cliente — SINCRÓNICAS,
 *    ven la configuración de la INSTANCIA. Quedan para los call sites que
 *    genuinamente no tienen contenedor.
 *
 * EL BUG QUE ESTO CIERRA, que estuvo vivo y no daba ningún error: `calculatePrice`
 * del provider ya resolvía las credenciales por tienda, pero el workflow de
 * tickets —que es el ÚNICO camino que CREA envíos reales— construía sus clientes
 * con `getCorreoClients()`, o sea con las credenciales del entorno. Resultado: la
 * tienda B cotizaba con su cuenta y despachaba contra el acuerdo de la tienda A.
 * El envío sale igual, el flete se factura al titular equivocado, y el
 * `trackingNumber` propio —que se deriva del `agreement`— puede colisionar dentro
 * de un acuerdo ajeno, que es irrecuperable.
 */

import type { Logger, MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { resolveSiteViaSql } from '../../lib/multistore/resolve-site-sql';
import type { SiteResolution } from '../../lib/multistore/types';
import MiCorreoClient from './clients/micorreo-client';
import PaqarClient from './clients/paqar-client';
import {
  applyCorreoSiteCredentials,
  readCorreoSiteCredentials,
} from './site-credentials';
import {
  getCorreoOperationSettings,
  getCorreoSettings,
  loadCorreoOperationSettingsViaPg,
  loadCorreoSettingsViaPg,
  micorreoFingerprint,
  paqarFingerprint,
  type CorreoOperationSettings,
  type PgRawConnection,
} from './settings';
import type { CorreoProviderOptions } from './types';

type MinimalLogger = Pick<Logger, 'info' | 'warn' | 'error' | 'debug'>;

export interface CorreoClients {
  /** Operar: órdenes, rótulos, tracking, sucursales. */
  paqar: PaqarClient;
  /** Cotizar: `POST /rates`. */
  micorreo: MiCorreoClient;
  options: CorreoProviderOptions;
  /**
   * Los flags que no son options del provider (auto-fulfillment, TN propio, URL
   * de seguimiento). Viajan en el mismo objeto porque el workflow de tickets
   * necesita los dos juegos para la MISMA tienda, y pedirlos por separado es cómo
   * se termina con el TN generado con el prefijo de una tienda y el acuerdo de
   * otra — que es una colisión irrecuperable dentro del acuerdo ajeno.
   */
  operation: CorreoOperationSettings;
}

/* -------------------------------------------------------------------------- */
/* Camino sincrónico: configuración de la INSTANCIA                            */
/* -------------------------------------------------------------------------- */

/**
 * Devuelve los dos clientes + las options resueltas de la instancia.
 *
 * Se construyen juntos porque casi todo flujo real necesita los dos (cotizar con
 * MiCorreo, operar con paqar) y las options son las mismas.
 */
export function getCorreoClients(logger: MinimalLogger): CorreoClients {
  const options = getCorreoSettings();
  return {
    paqar: new PaqarClient(options, logger),
    micorreo: new MiCorreoClient(options, logger),
    options,
    operation: getCorreoOperationSettings(),
  };
}

/** Solo paqar, para los caminos que no cotizan (rótulos, tracking, cancel). */
export function getCorreoPaqarClient(logger: MinimalLogger): PaqarClient {
  return new PaqarClient(getCorreoSettings(), logger);
}

/** Solo MiCorreo, para los caminos que solo cotizan (`/store/.../rates`). */
export function getCorreoMiCorreoClient(logger: MinimalLogger): MiCorreoClient {
  return new MiCorreoClient(getCorreoSettings(), logger);
}

/* -------------------------------------------------------------------------- */
/* Camino por tienda                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Cómo se identifica la tienda. Se aceptan las dos formas porque los call sites
 * tienen datos distintos a mano: el admin y las rutas scopeadas tienen `site_id`,
 * mientras que una orden o un carrito tienen `sales_channel_id` y sacarlo del
 * graph no cuesta nada. `siteId` gana: es explícito.
 */
export type CorreoSiteHint = {
  siteId?: string | null;
  salesChannelId?: string | null;
};

/**
 * Cache de clientes POR HUELLA, no por tiempo.
 *
 * Reconstruir en cada llamada NO es una opción: `MiCorreoClient` cachea un JWT por
 * instancia, así que un cliente nuevo por cotización es un `POST /token` por cada
 * vez que el comprador toca el selector de envío. Cachear por TIEMPO tampoco: una
 * credencial rotada desde el admin seguiría usándose hasta que venza el TTL.
 *
 * Con la huella, el cliente se reconstruye exactamente cuando cambia algo que le
 * importa — y ni un instante antes. Mismo patrón que `typesense/service.ts`
 * (`clientFingerprint`) y que `kapso-whatsapp/settings.ts`
 * (`credentialsFingerprint`).
 *
 * Se cachean POR SEPARADO paqar y MiCorreo porque sus huellas son disjuntas:
 * rotar la contraseña de MiCorreo no tiene por qué tirar el cliente de paqar, que
 * es el que está en el medio de un alta de envío.
 */
type ClientCache<T> = Map<string, { fingerprint: string; client: T }>;

const paqarCache: ClientCache<PaqarClient> = new Map();
const micorreoCache: ClientCache<MiCorreoClient> = new Map();

/** Sólo para tests: vacía las dos caches. */
export function __resetCorreoClientCache(): void {
  paqarCache.clear();
  micorreoCache.clear();
}

function cached<T>(
  cache: ClientCache<T>,
  scope: string,
  fingerprint: string,
  build: () => T,
): T {
  const hit = cache.get(scope);
  if (hit && hit.fingerprint === fingerprint) return hit.client;
  const client = build();
  cache.set(scope, { fingerprint, client });
  return client;
}

/** La clave de cache es el SCOPE, y la huella es lo que la invalida. */
const scopeKeyOf = (resolution: SiteResolution | undefined): string =>
  resolution?.status === 'site' ? resolution.site.id : '*global*';

function pgFrom(container: MedusaContainer): PgRawConnection | undefined {
  try {
    return container.resolve(
      ContainerRegistrationKeys.PG_CONNECTION,
    ) as unknown as PgRawConnection;
  } catch {
    return undefined;
  }
}

/**
 * Options de Correo para una tienda: configuración de `site_setting` con las
 * credenciales de `site_credential` encima.
 *
 * El orden importa y no es arbitrario. `site_setting` resuelve la configuración
 * con la precedencia de la decisión 3 (incluido el fail-closed de las tiendas
 * secundarias); `site_credential` es el almacén ESPECÍFICO de credenciales de
 * integración, con su propia clave de cifrado, y por eso pisa. Si una tienda cargó
 * su cuenta por la pantalla de credenciales, es esa la que tiene que despachar.
 *
 * Si la tienda declaró credenciales propias y su blob NO se puede descifrar
 * (típicamente porque rotó `JWT_SECRET`), esto TIRA en vez de caer al entorno.
 * Despachar con la cuenta de otro titular es peor que fallar: el envío sale igual
 * y se le factura a quien no corresponde. Es el mismo criterio de
 * `lib/multistore/credentials.ts:117`.
 */
export async function loadCorreoOptionsViaPg(
  pg: PgRawConnection | undefined,
  hint: string | CorreoSiteHint | undefined | null,
  logger: MinimalLogger,
): Promise<{ options: CorreoProviderOptions; resolution?: SiteResolution }> {
  const normalized: CorreoSiteHint =
    typeof hint === 'string' ? { siteId: hint } : (hint ?? {});

  if (!pg || (!normalized.siteId && !normalized.salesChannelId)) {
    return { options: await loadCorreoSettingsViaPg(pg) };
  }

  let resolution: SiteResolution | undefined;
  try {
    resolution = await resolveSiteViaSql(pg, {
      siteId: normalized.siteId ?? undefined,
      salesChannelId: normalized.salesChannelId ?? undefined,
    });
  } catch (error) {
    // No se pudo resolver la tienda: se sigue con la configuración de la
    // instancia, que es el comportamiento previo a esta migración. No se corta,
    // porque el registro de tiendas puede no existir (proyecto mono-tienda).
    logger.warn(
      `[correo-argentino] No se pudo resolver la tienda: ${
        error instanceof Error ? error.message : String(error)
      }. Se usa la configuración de la instancia.`,
    );
    return { options: await loadCorreoSettingsViaPg(pg) };
  }

  const options = await loadCorreoSettingsViaPg(pg, resolution);
  const creds = await readCorreoSiteCredentials(pg, resolution);

  return {
    options: creds ? applyCorreoSiteCredentials(options, creds) : options,
    resolution,
  };
}

/**
 * Los clientes de unas options ya resueltas, reusando la cache por huella.
 *
 * Está separado de la resolución porque tiene DOS llamadores que llegan con las
 * options por caminos distintos: `getCorreoClientsForSite` (contenedor completo) y
 * el provider de fulfillment, que sólo tiene `PG_CONNECTION` y no puede resolver
 * nada más. Con una sola cache, los dos comparten instancias y el JWT de MiCorreo
 * se pide una vez por tienda y no una por camino.
 */
export function correoClientsFor(
  options: CorreoProviderOptions,
  resolution: SiteResolution | undefined,
  logger: MinimalLogger,
  operation: CorreoOperationSettings = getCorreoOperationSettings(),
): CorreoClients {
  const scope = scopeKeyOf(resolution);
  return {
    paqar: cached(
      paqarCache,
      scope,
      paqarFingerprint(options),
      () => new PaqarClient(options, logger),
    ),
    micorreo: cached(
      micorreoCache,
      scope,
      micorreoFingerprint(options),
      () => new MiCorreoClient(options, logger),
    ),
    options,
    operation,
  };
}

/**
 * Los dos clientes con la cuenta de la tienda dueña de la operación.
 *
 * Es la variante que tienen que usar TODOS los call sites con contenedor. La
 * sincrónica queda sólo para los que genuinamente no lo tienen.
 */
export async function getCorreoClientsForSite(
  container: MedusaContainer,
  hint: string | CorreoSiteHint | undefined | null,
  logger: MinimalLogger,
): Promise<CorreoClients> {
  const pg = pgFrom(container);
  const { options, resolution } = await loadCorreoOptionsViaPg(pg, hint, logger);
  // No cuesta un viaje extra: `loadLayers` memoiza las filas por scope, así que
  // esto relee el MISMO jsonb que ya trajo la resolución de las options.
  const operation = await loadCorreoOperationSettingsViaPg(pg, resolution);
  return correoClientsFor(options, resolution, logger, operation);
}

/** Sólo paqar, con la cuenta de la tienda. Para rótulos, tracking y cancelaciones. */
export async function getCorreoPaqarClientForSite(
  container: MedusaContainer,
  hint: string | CorreoSiteHint | undefined | null,
  logger: MinimalLogger,
): Promise<PaqarClient> {
  return (await getCorreoClientsForSite(container, hint, logger)).paqar;
}
