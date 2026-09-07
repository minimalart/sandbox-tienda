/**
 * Store API — sucursales de Correo Argentino.
 *
 * GET /store/correo-argentino/agencies?state_id=AR-C
 * GET /store/correo-argentino/agencies?province=CABA&pickup_availability=true
 * GET /store/correo-argentino/agencies?postal_code=1414&package_reception=true
 *
 * Filtros que van A LA API (`GET /agencies`):
 *   - `state_id` / `province`   provincia; letra, ISO 3166-2 o nombre
 *   - `pickup_availability`     la sucursal entrega retiros
 *   - `package_reception`       la sucursal recibe paquetes
 *
 * Filtro que se aplica EN MEMORIA:
 *   - `postal_code`             `GET /agencies` NO filtra por CP
 *
 * ⚠️ Dos convenciones de provincia posibles: `POST /orders` usa la letra sola
 * (`"C"`) y el manual dice que `GET /agencies` usa ISO 3166-2 (`"AR-C"`). El
 * módulo manda la letra en las dos, por **INFERENCIA (sin verificar)** — ver
 * `buildAgencyParams()` en
 * `modules/correo-argentino-fulfillment/clients/paqar-client.ts`, que es el
 * único lugar donde se cambia. Si `/agencies` empieza a fallar en QA, es lo
 * primero a mirar.
 *
 * Esta ruta ACEPTA las tres representaciones en la entrada y
 * `parseCorreoAgencyQuery()` las colapsa a la letra antes de salir; el ISO se
 * devuelve en `filters.state_iso` porque es lo que el storefront usa para
 * mostrar. Nunca se le manda a Correo.
 *
 * El caché de 12 h no es una optimización opcional: sin filtro de provincia la
 * API devuelve el padrón completo del país (miles de sucursales, tamaño real sin
 * medir), y esto lo pega el checkout.
 */

import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { getCorreoPaqarClient } from '../../../../modules/correo-argentino-fulfillment/get-client';
import {
  isCorreoAgencyOperational,
  transformCorreoAgencies,
  type CorreoAgency,
} from '../../../../modules/correo-argentino-fulfillment/transformers/agencies';
import { extractErrorMessage } from '../../../../modules/correo-argentino-fulfillment/utils/errors';
import {
  correoAgencyCacheKey,
  parseCorreoAgencyQuery,
  provinceIsoOrNull,
  sendCorreoStoreError,
} from '../_shared';

/**
 * El padrón de sucursales cambia con frecuencia trimestral, no diaria. 12 h es el
 * mismo TTL que usa el plugin oficial de Correo con transients.
 */
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;

/** Caché de proceso, por combinación de filtros de API. Se pierde en cada deploy. */
const cache = new Map<string, { at: number; agencies: CorreoAgency[] }>();

/** Exportado para los tests: un caché de proceso no se puede resetear de afuera. */
export function clearCorreoAgencyCache(): void {
  cache.clear();
}

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);

  const parsed = parseCorreoAgencyQuery(req.query);
  if (!parsed.ok) {
    sendCorreoStoreError(res, 400, parsed.error);
    return;
  }
  const filters = parsed.query;

  // Sin filtro geográfico esto es el padrón completo del país (miles de
  // sucursales; el tamaño exacto no se midió) en cada request de checkout. Los
  // flags booleanos NO cuentan como filtro: `pickup_availability=true` sigue
  // siendo casi todo el país.
  if (!filters.state_id && !filters.postal_code) {
    sendCorreoStoreError(res, 400, {
      code: 'MISSING_FILTER',
      message:
        'Se requiere state_id/province o postal_code (sin filtro se pide el padrón completo del país)',
    });
    return;
  }

  const cacheKey = correoAgencyCacheKey(filters);

  try {
    const cached = cache.get(cacheKey);
    const fresh =
      cached !== undefined && Date.now() - cached.at < CACHE_TTL_MS;
    let agencies = fresh ? cached.agencies : undefined;

    if (!agencies) {
      const raw = await getCorreoPaqarClient(logger).getAgencies({
        // `stateId` va como LETRA. Ver la advertencia del encabezado.
        ...(filters.state_id ? { stateId: filters.state_id } : {}),
        ...(filters.pickup_availability !== undefined
          ? { pickupAvailability: filters.pickup_availability }
          : {}),
        ...(filters.package_reception !== undefined
          ? { packageReception: filters.package_reception }
          : {}),
      });

      agencies = transformCorreoAgencies(raw).filter(isCorreoAgencyOperational);
      cache.set(cacheKey, { at: Date.now(), agencies });
      logger.info(
        `[correo-agencies] Padrón "${cacheKey}" refrescado: ${agencies.length} sucursales operativas`
      );
    }

    let result = agencies;
    if (filters.postal_code) {
      // 38 sucursales del padrón real no tienen CP: no pueden matchear y quedan
      // fuera del filtro por CP, pero siguen disponibles filtrando por provincia.
      result = result.filter(
        (agency) => agency.address.postal_code === filters.postal_code
      );
    }

    res.status(200).json({
      agencies: result,
      count: result.length,
      filters: {
        state_id: filters.state_id ?? null,
        // ISO para el consumidor de la API, nunca para mandárselo a Correo.
        state_iso: provinceIsoOrNull(filters.state_id),
        postal_code: filters.postal_code ?? null,
        pickup_availability: filters.pickup_availability ?? null,
        package_reception: filters.package_reception ?? null,
      },
      cached: fresh,
    });
  } catch (error) {
    const message = extractErrorMessage(error);
    logger.error(`[correo-agencies] Lookup falló: ${message}`);
    sendCorreoStoreError(res, 503, {
      code: 'SERVICE_UNAVAILABLE',
      message: 'No se pudieron obtener las sucursales de Correo Argentino',
    });
  }
}
