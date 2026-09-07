import type { MedusaRequest } from '@medusajs/framework/http';
import { siteFromRequest } from '../../../lib/multistore/request';
import { getCorreoClientsForSite } from '../../../modules/correo-argentino-fulfillment/get-client';
import type { CorreoLabelDownloadInput } from '../../../modules/correo-argentino-fulfillment/label-download';
import type { Logger } from '@medusajs/framework/types';

/**
 * Mismo alias que declaran `get-client.ts` y `label-download.ts`, local también acá.
 * Tres copias de un alias ESTRUCTURAL no son el mismo riesgo que tres copias de un
 * descriptor de scope: una divergencia acá es un error de compilación, no un cambio
 * silencioso de qué ve una tienda.
 */
type MinimalLogger = Pick<Logger, 'info' | 'warn' | 'error' | 'debug'>;

/**
 * El `site` de `downloadCorreoLabels` para una request del admin.
 *
 * Un rótulo se pide con la cuenta de MiCorreo de la tienda DUEÑA del envío, no con
 * la de la instancia. Las tres rutas que bajan rótulos —`labels`, `labels/[id]` y
 * `tickets/bulk`— llamaban a `downloadCorreoLabels` sin resolver tienda, así que
 * usaban la cuenta principal: con el tracking number a mano, una tienda secundaria
 * pedía el rótulo de otra.
 *
 * Vive acá y no copiado en las tres a propósito. El registro de rutas ya dejó escrito
 * (`scoped-routes.ts:180`) que las dos mitades de Correo tienen que mirar la MISMA
 * cuenta: "si una mitad mirara la otra…". Tres copias de la resolución es la forma
 * exacta en que una se queda vieja — y en este mismo trabajo hubo que consolidar dos
 * descriptores de scope duplicados por eso.
 *
 * Devuelve `undefined` cuando no hay tienda activa. No es un fallback silencioso: es
 * la capa de instancia, donde la cuenta correcta ES la de la instancia, y
 * `downloadCorreoLabels` ya la resuelve sola cuando no recibe `site`.
 */
export async function correoSiteFor(
  req: MedusaRequest,
  logger: MinimalLogger,
): Promise<CorreoLabelDownloadInput['site']> {
  const resolution = await siteFromRequest(req);
  if (resolution.status !== 'site') return undefined;

  const { paqar, options } = await getCorreoClientsForSite(
    req.scope,
    { siteId: resolution.site.id },
    logger,
  );

  return { paqar, options };
}
