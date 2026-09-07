import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { Logger } from '@medusajs/framework/types';
import { STORE_CONFIG_MODULE } from '../../../modules/store-config';
import StoreConfigModuleService, {
  STORE_SETTING_KEYS,
} from '../../../modules/store-config/service';
import { STORE_LOCATION_MODULE } from '../../../modules/store-location';
import type StoreLocationModuleService from '../../../modules/store-location/service';
import {
  extractCoordinates,
  filterOptionsByCoverage,
  type CoverageShippingOption,
} from '../../../modules/store-location/coverage/shipping-gate';
import { geocodeAddress } from '../../../modules/delivery/geocoding';
import { siteIdFromPublishableKey } from '../../../lib/multistore/publishable-key';

/**
 * Gate de `GET /store/shipping-options`: saca del checkout el envío de FLOTA
 * PROPIA cuando la dirección del cliente cae fuera de todos los polígonos de
 * cobertura de las sucursales.
 *
 * Por qué en el backend y no en la UI: la ruta es NATIVA de Medusa y el
 * storefront elige la opción por id. Esconder "Envío Estándar" en el checkout
 * deja la opción igual de seleccionable por API, y el resultado es una orden que
 * la flota no puede entregar. El backend es la fuente de verdad; el aviso en la
 * UI se dibuja con lo que este gate publica en `shipping_coverage`.
 *
 * Se implementa como MIDDLEWARE y no como hook del workflow a propósito: no hay
 * ruta custom que reemplazar, y envolver `res.json` deja intacta la lógica de
 * precios/reglas del core — sólo recorta la lista que ya calculó.
 *
 * CONTRATO que consume el storefront:
 *   shipping_coverage?: { evaluated: boolean; covered: boolean }
 * Ausente o `evaluated: false` = el gate no opinó (feature apagada, sin cart o
 * sin coords) y no hay nada nuevo que mostrar. `{ evaluated: true, covered:
 * false }` es el único caso que dispara el aviso de "sin cobertura".
 *
 * TODO el cuerpo es fail-open: ante cualquier error inesperado se loguea y se
 * deja pasar la respuesta nativa. Un gate que rompe el checkout es peor que el
 * bug que arregla.
 */
export async function shippingCoverageGate(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
): Promise<void> {
  const logger = req.scope.resolve<Logger>(ContainerRegistrationKeys.LOGGER);

  try {
    // Los dos módulos son opcionales (`optionalModule('storeConfig'|
    // 'storeLocation', …)`): sin ellos no hay ni flag ni polígonos, así que el
    // gate no existe.
    let configService: StoreConfigModuleService;
    let locationService: StoreLocationModuleService;
    try {
      configService = req.scope.resolve<StoreConfigModuleService>(STORE_CONFIG_MODULE);
      locationService = req.scope.resolve<StoreLocationModuleService>(STORE_LOCATION_MODULE);
    } catch {
      return next();
    }

    /**
     * Los flags se leen POR TIENDA, igual que en `store-config/route.ts`: la fila
     * de `store_setting` tiene `site_id` con precedencia y una tienda sin fila
     * propia hereda la global. Leerlos sin `siteId` haría que una tienda que
     * apagó la cobertura siguiera filtrando por la config de otra.
     */
    const siteId = await siteIdFromPublishableKey(req);
    const [multiBranch, requireCoverage] = await Promise.all([
      configService.getBooleanSetting(STORE_SETTING_KEYS.MULTI_BRANCH_ENABLED, false, siteId),
      configService.getBooleanSetting(STORE_SETTING_KEYS.REQUIRE_BRANCH_COVERAGE, false, siteId),
    ]);
    // No-op TOTAL con los flags apagados: ni siquiera se publica
    // `shipping_coverage`. Ninguna instalación existente cambia de comportamiento
    // por este middleware.
    if (!multiBranch || !requireCoverage) {
      /**
       * Este es el PRIMER middleware del repo que llama a
       * `siteIdFromPublishableKey` — todos los demás usos están dentro de route
       * handlers, que corren garantizado DESPUÉS del middleware core que puebla
       * `publishable_key_context`. Si acá corriéramos antes, `siteId` sería
       * `null` y los flags saldrían de la fila GLOBAL en vez de la de la tienda:
       * el gate quedaría apagado en silencio para quien lo prendió por sitio.
       *
       * Degradación suave (no rompe nada), pero indistinguible de "la feature
       * está apagada a propósito". Por eso se loguea el `siteId` resuelto: el
       * primer smoke con dos tiendas dice cuál de los dos casos es.
       */
      logger.debug(
        `[store-locations] gate de cobertura no-op (site=${siteId ?? 'global'}, multi_branch=${multiBranch}, require_coverage=${requireCoverage})`
      );
      return next();
    }

    const cartId = typeof req.query?.cart_id === 'string' ? req.query.cart_id : null;
    // Sin cart no hay dirección que evaluar: es el listado genérico de opciones
    // (el que usa, por ejemplo, la barra de envío gratis).
    if (!cartId) return next();

    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
    const { data: carts } = (await query.graph({
      entity: 'cart',
      fields: ['id', 'shipping_address.*'],
      filters: { id: cartId },
    })) as {
      data: Array<{
        id: string;
        shipping_address?: {
          metadata?: Record<string, unknown> | null;
          address_1?: string | null;
          city?: string | null;
          province?: string | null;
          postal_code?: string | null;
          country_code?: string | null;
        } | null;
      }>;
    };

    const shippingAddress = carts[0]?.shipping_address ?? null;
    // Todavía no cargó la dirección (paso 1 del checkout): no hay nada contra qué
    // resolver, y adelantar un "sin cobertura" sería mentir.
    if (!shippingAddress) return next();

    /**
     * COORDS — dos fuentes, en este orden:
     *  1) `metadata.latitude/longitude` que capturó Google Places en el
     *     storefront.
     *  2) GEOCODING de respaldo, para la dirección tipeada a mano.
     * Mismo orden que `create-delivery-execution`, y no por casualidad: si las
     * dos capas resolvieran el punto distinto, el checkout mostraría una
     * cobertura y el envío se asignaría a otra sucursal.
     */
    let coords = extractCoordinates(shippingAddress);
    if (!coords) {
      const geocoded = await geocodeAddress(
        {
          address_1: shippingAddress.address_1 ?? null,
          city: shippingAddress.city ?? null,
          province: shippingAddress.province ?? null,
          postal_code: shippingAddress.postal_code ?? null,
          country_code: shippingAddress.country_code ?? null,
        },
        { logger }
      );
      if (geocoded) coords = { lat: String(geocoded.lat), lng: String(geocoded.lng) };
    }
    // Sin coords NO se bloquea. El geocoding es best-effort (puede no haber API
    // key, o la dirección puede ser ambigua) y dejar sin envío a alguien porque
    // Google no la encontró es exactamente el error caro.
    if (!coords) return next();

    const covered = !!(await locationService.resolveByPoint(coords));

    /**
     * Se envuelve `res.json` ANTES del `next()` porque quien responde es el
     * handler NATIVO: no hay otra forma de tocar el body sin duplicar la ruta.
     *
     * El wrapper es deliberadamente tímido: si el body no trae
     * `shipping_options` (un error del core, por ejemplo) pasa TAL CUAL. Y el
     * resto de las claves se preserva con spread, así que sumar
     * `shipping_coverage` no puede romper a un consumidor existente.
     */
    const originalJson = res.json.bind(res);
    res.json = ((body: unknown) => {
      try {
        if (
          body &&
          typeof body === 'object' &&
          Array.isArray((body as { shipping_options?: unknown }).shipping_options)
        ) {
          const source = body as Record<string, unknown> & {
            shipping_options: CoverageShippingOption[];
          };
          return originalJson({
            ...source,
            shipping_options: filterOptionsByCoverage(source.shipping_options, covered),
            shipping_coverage: { evaluated: true, covered },
          });
        }
      } catch (error) {
        // Fail-open también acá: se responde lo que había.
        logger.error(
          `[store-locations] el gate de cobertura no pudo filtrar la respuesta del cart ${cartId}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
      return originalJson(body as never);
    }) as typeof res.json;

    return next();
  } catch (error) {
    // Base caída, query mal formada, geocoding que lanza: nada de eso puede
    // trabar el checkout. Se loguea y se deja pasar la respuesta nativa — el
    // costo es que esa request no filtra, que es el comportamiento de antes.
    logger.error(
      `[store-locations] el gate de cobertura de envío falló y se deja pasar: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return next();
  }
}
