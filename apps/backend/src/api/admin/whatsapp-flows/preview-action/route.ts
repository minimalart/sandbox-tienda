import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import { previewPlan } from '../../../../lib/whatsapp/flow/preview';
import { groupHitsByProduct } from '../../../../lib/whatsapp/group-hits';
import {
  getWaVariantDetail,
  hydrateWaProductIds,
  listWaFilteredProducts,
  listWaPinnedProducts,
  listWaProductPresentations,
  searchWaProducts,
  waFilteredProductIds,
  waHitsToOptions,
  type WaPresentationOption,
} from '../../../../lib/whatsapp/search-products';
import { resolveWaOrderContext } from '../../../../lib/whatsapp/order-context';
import { answerOrderLookup } from '../../../../lib/whatsapp/order-lookup';
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
 * Las funciones que se llaman son las MISMAS que usa el bot en producción, así que lo
 * que se ve acá es lo que va a salir — con el mismo canal de venta, el mismo precio
 * calculado y el mismo stock. Una consulta propia "parecida" volvería a mentir, que es
 * el problema que esto arregla.
 *
 * ─── POR QUÉ ADEMÁS DEVUELVE `options` ───────────────────────────────────────────
 *
 * En producción estas acciones no le hablan al cliente: publican sus resultados en
 * `vars.<save_as>` y el paso SIGUIENTE los ofrece con `optionsFrom`. En la prueba la
 * acción no se ejecutaba, así que ese `vars` quedaba vacío y la pregunta siguiente
 * salía sin ninguna opción; la única salida era que el operador escribiera a mano el
 * JSON de las opciones —con los ids de variante adentro— en un campo de texto. Eso no
 * es probar un recorrido, es adivinarlo.
 *
 * Devolviendo las mismas opciones que la tool habría publicado, el simulador las
 * escribe en el `vars` de la sesión y el recorrido sigue solo.
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

  /**
   * Dónde deja la acción sus resultados. Sin `save_as` la tool le habla al cliente
   * ella misma y no hay ninguna variable que completar: la prueba muestra las
   * tarjetas y nada más.
   */
  const saveAs = typeof args.save_as === 'string' && args.save_as.trim() ? args.save_as.trim() : null;

  /**
   * La consulta de pedido NO es catálogo: devuelve el TEXTO que recibiría el cliente,
   * por la misma función que usa la acción en producción. Si el paso tiene `save_as`
   * el simulador lo escribe en `vars` y el mensaje siguiente lo muestra.
   */
  if (plan.kind === 'order') {
    try {
      const answer = await answerOrderLookup(req.scope, plan.orderNumber, plan.email);
      res.json({ kind: 'text', outcome: answer.outcome, text: answer.text, save_as: saveAs });
    } catch (error) {
      res.json({ kind: 'unsupported', reason: `No se pudo consultar el pedido: ${(error as Error).message}` });
    }
    return;
  }

  try {
    const ctx = await resolveWaOrderContext(req.scope);

    if (plan.kind === 'detail') {
      const detail = await getWaVariantDetail(req.scope, plan.variantId, { ctx });
      res.json({
        kind: 'cards',
        currency_code: ctx.currency_code,
        save_as: saveAs,
        options: [],
        cards: detail
          ? [
              {
                id: plan.variantId,
                title: detail.title,
                price: detail.unit_price,
                image_url: detail.image_url,
                in_stock: true,
                variant_count: 1,
              },
            ]
          : [],
      });
      return;
    }

    /**
     * Las presentaciones salen de la función de producción y NO se dibujan como
     * carrusel: son el mismo producto en 1 L, 4 L y 20 L, o sea la misma foto tres
     * veces. Lo que importa ver es la lista tal cual la recibe el cliente.
     */
    if (plan.kind === 'presentations') {
      const options = await listWaProductPresentations(req.scope, {
        ...(plan.variantId ? { variantId: plan.variantId } : {}),
        ...(plan.productId ? { productId: plan.productId } : {}),
      });
      res.json({ kind: 'cards', currency_code: ctx.currency_code, save_as: saveAs, options, cards: [] });
      return;
    }

    /**
     * Se piden de más y se agrupa después, igual que el bot: cada fila es una
     * variante, así que sin agrupar un producto de cuatro presentaciones se comería
     * cuatro de las diez tarjetas. La vista previa tiene que mostrar EXACTAMENTE lo
     * que va a salir, y lo que sale son productos.
     */
    /**
     * `wa_list_pinned` y `wa_list_filtered` van por SU función de producción, que
     * además filtra por el canal de venta del bot. Hidratando por nuestra cuenta, un
     * producto que el bot no puede vender aparecía en la prueba y después rebotaba en
     * el carrito del cliente: la vista previa mentía justo donde tenía que avisar.
     */
    let options: WaPresentationOption[] = [];
    let productIds: string[] = [];
    if (plan.kind === 'pinned') {
      productIds = plan.productIds;
      options = await listWaPinnedProducts(req.scope, productIds, { ctx });
    } else if (plan.kind === 'filtered') {
      productIds = await waFilteredProductIds(req.scope, plan.filter, ctx.sales_channel_ids, 30);
      options = await listWaFilteredProducts(req.scope, plan.filter, { ctx });
    }

    const { hits } =
      plan.kind === 'search'
        ? await searchWaProducts(req.scope, { query: plan.query, limit: 30, ctx })
        : await hydrateWaProductIds(req.scope, productIds, { limit: 50, ctx });

    if (plan.kind === 'search') {
      const agrupados = groupHitsByProduct(hits).slice(0, 10);
      options = waHitsToOptions(agrupados, ctx.currency_code);
      res.json({
        kind: 'cards',
        currency_code: ctx.currency_code,
        save_as: saveAs,
        options,
        cards: agrupados.map(toCard),
      });
      return;
    }

    // Las tarjetas se recortan a lo que la función de producción dejó pasar: lo que no
    // está en `options` es lo que el bot no puede vender, y mostrarlo sería mentir.
    const vendibles = new Set(options.map((o) => o.value));
    const cards = groupHitsByProduct(hits)
      .filter((h) => vendibles.has(h.variant_id))
      .slice(0, 10)
      .map(toCard);

    res.json({ kind: 'cards', currency_code: ctx.currency_code, save_as: saveAs, options, cards });
  } catch (error) {
    // Una vista previa que falla no puede romper la prueba: se cae a la descripción.
    res.json({ kind: 'unsupported', reason: `No se pudo consultar el catálogo: ${(error as Error).message}` });
  }
}

/**
 * El `id` es el `variant_id`, que es EXACTAMENTE lo que manda el botón del carrusel en
 * WhatsApp. Así la vista previa no es una foto: tocar un producto acá hace avanzar el
 * recorrido igual que lo haría el cliente.
 */
const toCard = (h: {
  variant_id: string;
  title: string;
  unit_price: number | null;
  image_url: string | null;
  in_stock: boolean;
  variant_count: number;
}) => ({
  id: h.variant_id,
  title: h.title,
  price: h.unit_price,
  image_url: h.image_url,
  in_stock: h.in_stock,
  variant_count: h.variant_count,
});
