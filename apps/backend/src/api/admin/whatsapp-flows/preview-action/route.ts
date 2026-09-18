import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import { previewPlan } from '../../../../lib/whatsapp/flow/preview';
import { groupHitsByProduct } from '../../../../lib/whatsapp/group-hits';
import {
  hydrateWaProductIds,
  searchWaProducts,
  waFilteredProductIds,
} from '../../../../lib/whatsapp/search-products';
import { resolveWaOrderContext } from '../../../../lib/whatsapp/order-context';
import { siteFromRequest } from '../../../../lib/multistore/request';

/**
 * POST /admin/whatsapp-flows/preview-action — qué le llegaría al cliente.
 *
 * El simulador probaba el DIBUJO: que el turno llegue hasta acá y siga por la flecha
 * correcta. Lo que no probaba era el contenido, que es la mitad de lo que se publica:
 * si la búsqueda encuentra algo, si los productos tienen foto, si el título entra en
 * una tarjeta de WhatsApp y si el precio se lee. Eso sólo se sabe corriendo la
 * búsqueda de verdad contra el catálogo de verdad.
 *
 * **Sólo lectura, y la lista está escrita a mano.** `previewPlan` decide qué se puede
 * correr; lo que toca el carrito, genera un link de pago o despierta a alguien del
 * equipo se sigue describiendo. Agregar una tool nueva no la habilita sola: hay que
 * ponerla en esa lista, que es donde alguien tiene que pensarlo.
 *
 * Las dos funciones que se llaman son las MISMAS que usa el bot en producción
 * (`searchWaProducts`, `hydrateWaProductIds`), así que lo que se ve acá es lo que va a
 * salir — con el mismo canal de venta, el mismo precio calculado y el mismo stock. Una
 * consulta propia "parecida" volvería a mentir, que es el problema que esto arregla.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  // El scope se resuelve aunque las funciones de catálogo todavía no lo tomen: es el
  // eje que el repo audita, y el día que la búsqueda sea por tienda ya está enhebrado.
  await siteFromRequest(req);

  const body = (req.body ?? {}) as Record<string, unknown>;
  const tool = typeof body.tool === 'string' ? body.tool : undefined;
  const args = (body.args && typeof body.args === 'object' ? body.args : {}) as Record<string, unknown>;

  const plan = previewPlan(tool, args);
  if (plan.kind === 'unsupported') {
    res.json({ kind: 'unsupported', reason: plan.reason });
    return;
  }

  try {
    /**
     * Se piden de más y se agrupa después, igual que el bot: cada fila es una
     * variante, así que sin agrupar un producto de cuatro presentaciones se comería
     * cuatro de las diez tarjetas. La vista previa tiene que mostrar EXACTAMENTE lo
     * que va a salir, y lo que sale son productos.
     */
    const ctx = await resolveWaOrderContext(req.scope);
    const ids =
      plan.kind === 'filtered'
        ? await waFilteredProductIds(req.scope, plan.filter, ctx.sales_channel_ids, 30)
        : plan.kind === 'pinned'
          ? plan.productIds
          : null;

    const { hits } =
      ids !== null
        ? await hydrateWaProductIds(req.scope, ids, { limit: 50, ctx })
        : await searchWaProducts(req.scope, { query: (plan as { query: string }).query, limit: 30, ctx });

    res.json({
      kind: 'cards',
      currency_code: ctx.currency_code,
      /**
       * El `id` es el `variant_id`, que es EXACTAMENTE lo que manda el botón del
       * carrusel en WhatsApp. Así la vista previa no es una foto: tocar un producto
       * acá hace avanzar el recorrido igual que lo haría el cliente.
       */
      cards: groupHitsByProduct(hits)
        .slice(0, 10)
        .map((h) => ({
          id: h.variant_id,
          title: h.title,
          price: h.unit_price,
          image_url: h.image_url,
          in_stock: h.in_stock,
          variant_count: h.variant_count,
        })),
    });
  } catch (error) {
    // Una vista previa que falla no puede romper la prueba: se cae a la descripción.
    res.json({ kind: 'unsupported', reason: `No se pudo consultar el catálogo: ${(error as Error).message}` });
  }
}
