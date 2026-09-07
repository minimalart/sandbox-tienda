import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { addToCartWorkflow } from '@medusajs/medusa/core-flows';
import { ERP_MODULE } from '../../../../modules/erp';
import type ErpModuleService from '../../../../modules/erp/service';
import {
  quoteTinting,
  tintingMaxQuantity,
  TintingQuoteError,
} from '../../../../modules/erp/tinting/quote';
import type { ErpConfigSettings } from '../../../../modules/erp/types';
import { buildTintMetadata, tintLineSubtitle } from '../../../../modules/erp/tinting/line-metadata';
import { loadCartContext, loadVariantInfo } from '../context';
import type { PostStoreTintingLineItemType } from '../validators';

/**
 * POST /store/tinting/line-items — agrega al carrito una base entonada, con el
 * precio que calculó el ERP.
 *
 * Existe porque la Store API de Medusa NO acepta un precio de línea: su
 * validador es `{variant_id, quantity, metadata}` y zod descarta cualquier otra
 * clave EN SILENCIO. El workflow interno sí lo acepta (`addToCartWorkflow` setea
 * `isCustomPrice` cuando viene `unit_price`), y el precio custom sobrevive al
 * refresh del carrito, a los cambios de cantidad y al checkout.
 *
 * Es el ÚNICO lugar que escribe el precio y `metadata.tint`: la fórmula se
 * resuelve en el servidor a partir de `(variant_id, color_code)` y se re-cotiza
 * acá. Nada de lo que venga en el body decide el precio — si no, el comprador
 * elegiría cuánto pagar.
 *
 * NO se manda `is_tax_inclusive` a propósito: sin ese campo el workflow hereda
 * el de la variante, que es exactamente lo que queremos (el precio del entonado
 * queda en la misma base impositiva que el precio de catálogo de la base).
 */
export async function POST(
  req: MedusaRequest<PostStoreTintingLineItemType>,
  res: MedusaResponse
): Promise<void> {
  const body = req.validatedBody;

  const service = req.scope.resolve<ErpModuleService>(ERP_MODULE);
  const config = await service.getActiveConfig().catch(() => null);
  const settings = (config?.settings ?? {}) as ErpConfigSettings;

  if (!settings.tinting?.enabled) {
    res.status(404).json({ message: 'El sistema tintométrico no está disponible.' });
    return;
  }

  const maxQuantity = tintingMaxQuantity(settings);
  if (body.quantity > maxQuantity) {
    res.status(400).json({ message: `La cantidad máxima por línea es ${maxQuantity}.` });
    return;
  }

  try {
    const cart = await loadCartContext(req, body.cart_id);
    if (!cart) {
      res.status(404).json({ message: 'No encontramos el carrito.' });
      return;
    }

    const variant = await loadVariantInfo(req, body.variant_id, cart);
    if (!variant?.sku) {
      res.status(404).json({ message: 'No encontramos esa base en el catálogo.' });
      return;
    }

    const { quote, selection, list_index } = await quoteTinting(req.scope, {
      article_code: variant.sku,
      color_code: body.color_code,
      collection: body.collection ?? null,
      quantity: body.quantity,
      customer_group_ids: cart.customer_group_ids,
      base_unit_price: variant.base_unit_price,
    });

    await addToCartWorkflow(req.scope).run({
      input: {
        cart_id: cart.cart_id,
        items: [
          {
            variant_id: variant.variant_id,
            quantity: body.quantity,
            unit_price: quote.unit_price,
            subtitle: tintLineSubtitle(selection),
            metadata: buildTintMetadata({
              selection,
              list_index,
              unit_price: quote.unit_price,
            }),
          },
        ],
      },
    });

    res.json({
      added: true,
      unit_price: quote.unit_price,
      line_total: quote.line_total,
      color: {
        code: selection.color.code,
        name: selection.color.name,
        collection: selection.color.collection,
        hex: selection.color.hex,
      },
    });
  } catch (error) {
    if (error instanceof TintingQuoteError) {
      if (error.reason === 'disabled') {
        res.status(404).json({ message: 'El sistema tintométrico no está disponible.' });
        return;
      }
      if (error.reason === 'unknown_selection' || error.reason === 'not_quotable') {
        res.status(422).json({ message: error.message });
        return;
      }
      // Acá NO se degrada a "agregado sin precio": una línea sin precio del ERP
      // sería vender a un precio inventado. El storefront ofrece agregar la base
      // sin entonar, que es una decisión del comprador, no nuestra.
      res.status(424).json({
        message: 'No pudimos calcular el precio del color en este momento. Probá de nuevo en un rato.',
      });
      return;
    }

    console.error(
      '[tinting] line-item error inesperado:',
      error instanceof Error ? error.stack : error
    );
    res.status(500).json({ message: 'No pudimos agregar el producto al carrito.' });
  }
}
