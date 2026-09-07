import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import { lookupTaxpayer } from '../../../../lib/arca/lookup';
import { getArcaConfigForSite, isArcaConfigured } from '../../../../lib/arca/config';
import {
  ArcaConfigError,
  ArcaInvalidCuitError,
  ArcaNotFoundError,
  ArcaUnavailableError,
  type ArcaCache,
} from '../../../../lib/arca/types';
import type { PostArcaTaxpayerLookupType } from './validators';

/**
 * Consulta la constancia de inscripción de un CUIT en ARCA y devuelve los
 * datos fiscales normalizados para autocompletar Factura A en el checkout.
 * Público (solo publishable key: el checkout soporta guest); protegido por
 * rate limit por IP + cache por CUIT. Nunca expone la respuesta SOAP cruda.
 *
 * Endurecida a prueba de fallas: TODA salida es JSON (nunca rethrow — el
 * checkout no puede depender de este endpoint) y el cache del container
 * tiene fallback in-memory por si el módulo CACHE no resuelve.
 */

const MEMORY_CACHE_MAX = 2_000;
const memoryStore = new Map<string, { data: unknown; expiresAt: number }>();
const memoryArcaCache: ArcaCache = {
  async get<T>(key: string): Promise<T | null> {
    const entry = memoryStore.get(key);
    if (!entry || entry.expiresAt <= Date.now()) {
      memoryStore.delete(key);
      return null;
    }
    return entry.data as T;
  },
  async set(key: string, data: unknown, ttl = 3600): Promise<void> {
    if (memoryStore.size > MEMORY_CACHE_MAX) {
      const now = Date.now();
      for (const [k, v] of memoryStore) {
        if (v.expiresAt <= now) memoryStore.delete(k);
      }
    }
    memoryStore.set(key, { data, expiresAt: Date.now() + ttl * 1000 });
  },
};

function resolveCache(req: MedusaRequest): ArcaCache {
  try {
    const cache = req.scope.resolve(Modules.CACHE) as unknown as ArcaCache | undefined;
    if (cache && typeof cache.get === 'function' && typeof cache.set === 'function') {
      return cache;
    }
  } catch {
    // Sin módulo CACHE en el container: fallback in-memory.
  }
  return memoryArcaCache;
}

function resolveLog(req: MedusaRequest): (line: string) => void {
  try {
    const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);
    return (line) => logger.info(line);
  } catch {
    return (line) => console.log(line);
  }
}

/** Logger mínimo para `getArcaConfigForSite`, que sólo avisa cuando degrada. */
function resolveWarn(req: MedusaRequest): { warn: (line: string) => void } {
  try {
    const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);
    return { warn: (line) => logger.warn(line) };
  } catch {
    return { warn: (line) => console.warn(line) };
  }
}

/**
 * La tienda sale de la PUBLISHABLE KEY: acá no hay header `x-site-id` —eso es del
 * admin— y el storefront no manda ninguno. Mismo camino que
 * `store/gift-card-experience/designs/route.ts`.
 *
 * Importa más que en cualquier otra ruta store del repo: lo que se resuelve con esto
 * es CON QUÉ CERTIFICADO se le habla a AFIP. Sin la tienda, la consulta sale con la
 * identidad fiscal de la instancia; con ella, una tienda secundaria que no cargó la
 * suya queda apagada por fail-closed en vez de usar la ajena.
 */
function salesChannelOf(req: MedusaRequest): string | null {
  const channelIds = (
    req as unknown as { publishable_key_context?: { sales_channel_ids?: string[] } }
  ).publishable_key_context?.sales_channel_ids;
  return channelIds?.[0] ?? null;
}

/**
 * Diagnóstico liviano: dice si la INSTANCIA tiene la identidad fiscal cargada.
 *
 * Sigue siendo de instancia y no de tienda a propósito. Es un endpoint público (sólo
 * publishable key) que el storefront usa para decidir si muestra el autocompletado
 * de Factura A; responder por tienda le daría a cualquiera con una publishable key
 * un mapa de qué tiendas del backend tienen certificado propio. El POST sí resuelve
 * la tienda, que es donde importa.
 */
export async function GET(_req: MedusaRequest, res: MedusaResponse): Promise<void> {
  res.json({ configured: isArcaConfigured() });
}

export async function POST(
  req: MedusaRequest<PostArcaTaxpayerLookupType>,
  res: MedusaResponse
): Promise<void> {
  const started = Date.now();
  const log = resolveLog(req);
  const cuit = String(req.validatedBody?.cuit ?? '').replace(/\D/g, '');

  const done = (outcome: string) =>
    log(`[ARCA] lookup cuit=${cuit} outcome=${outcome} ms=${Date.now() - started}`);

  try {
    log(`[ARCA] lookup start cuit=${cuit} configured=${isArcaConfigured()}`);
    const config = await getArcaConfigForSite(
      req.scope,
      { salesChannelId: salesChannelOf(req) },
      resolveWarn(req),
    );
    const taxpayer = await lookupTaxpayer(cuit, { cache: resolveCache(req), config });
    done('ok');
    res.json({ taxpayer });
  } catch (error) {
    if (error instanceof ArcaInvalidCuitError) {
      done('invalid');
      res.status(400).json({ message: error.message });
      return;
    }
    if (error instanceof ArcaNotFoundError) {
      done('not_found');
      res
        .status(404)
        .json({ message: 'No encontramos ese CUIT en ARCA. Revisalo o completá los datos a mano.' });
      return;
    }
    if (!(error instanceof ArcaConfigError) && !(error instanceof ArcaUnavailableError)) {
      // Error inesperado: dejar el stack en los logs del server (nunca al
      // cliente) y degradar a 503 igual — este endpoint jamás debe romper
      // el checkout ni matar la conexión.
      const detail = error instanceof Error ? (error.stack ?? error.message) : String(error);
      console.error(`[ARCA] lookup error inesperado cuit=${cuit}:`, detail);
    }
    done('unavailable');
    // 424 (Failed Dependency) y no 503: DO App Platform intercepta los 503
    // que devuelve la app y los reemplaza por su página de error
    // "via_upstream" (el navegador ve un 504 de DO sin nuestro JSON). Fue la
    // causa raíz del bug del checkout: el endpoint respondía 503 limpio y la
    // plataforma lo pisaba. El storefront solo mira res.ok + message.
    res
      .status(424)
      .json({ message: 'No pudimos consultar ARCA en este momento. Completá los datos a mano.' });
  }
}
