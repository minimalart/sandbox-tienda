import type { MedusaRequest } from '@medusajs/framework/http';
import { MedusaError } from '@medusajs/framework/utils';
import { siteFromRequest } from '../../../lib/multistore/request';
import { productIdsForSite } from '../../../lib/multistore/product-scope';

/**
 * El producto sobre el que se opera tiene que ser del catálogo de la tienda activa.
 *
 * Vive en un `_helpers` y no adentro de una `route.ts` por la misma razón que
 * `fiscal-documents/_helpers.ts`: dos rutas hermanas necesitan el MISMO criterio, y
 * la alternativa —importar de `../route`— haría que el loader de Medusa cargue un
 * archivo de ruta por un camino que no es el suyo.
 *
 * El id llega por BODY y no por path. Eso es exactamente lo que hacía que las dos
 * rutas de correcciones fueran invisibles para los tres ratchets de tienda: no
 * tienen `[param]` ni GET. La puerta es la misma que la de un `[id]` —alcanza con
 * saber el id, y los ids de producto salen de un export, de una URL vieja o del
 * propio storefront—, sólo que entra por otro lado.
 *
 * 404 y no 403, por el mismo motivo que `assertIdInSite`: un 403 confirmaría que
 * ese producto existe en otra tienda.
 */
export async function assertProductInSite(req: MedusaRequest, productId: string): Promise<void> {
  /**
   * El corto circuito va acá y explícito, y no delegado al `null` de
   * `productIdsForSite`, por dos razones que apuntan al mismo lado:
   *
   *  1. Sin tienda activa no se paga el recorrido del link de canal, que pagina de
   *     a 1000 sobre `product_sales_channel`. En una instalación mono-tienda —hoy
   *     casi todas— es el 100% de las llamadas.
   *  2. Deja el eje a la VISTA en el archivo que guarda. `admin-site-scope.test.ts`
   *     sigue los imports UN salto y no más, así que un guard que resuelve la
   *     tienda a dos saltos de distancia es indistinguible de uno que no la
   *     resuelve nunca. Y tiene razón en no distinguirlos: si hay que seguir tres
   *     archivos para saber si una ruta aplica el eje, la próxima revisión no los
   *     va a seguir.
   */
  const resolution = await siteFromRequest(req);
  if (resolution.status !== 'site') return;

  const allowed = await productIdsForSite(req);
  // `null` = no hay que filtrar. `[]` NO es lo mismo: una tienda sin catálogo no
  // puede tocar ningún producto, y tratar el vacío como "sin filtro" es el error
  // que `productIdsForSite` documenta en su propia cabecera.
  if (allowed === null) return;
  if (!allowed.includes(productId)) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, 'No encontrado.');
  }
}
