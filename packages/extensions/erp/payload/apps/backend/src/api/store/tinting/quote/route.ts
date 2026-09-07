import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { ERP_MODULE } from '../../../../modules/erp';
import type ErpModuleService from '../../../../modules/erp/service';
import {
  quoteTinting,
  tintingMaxQuantity,
  TintingQuoteError,
} from '../../../../modules/erp/tinting/quote';
import type { ErpConfigSettings } from '../../../../modules/erp/types';
import { loadCartContext, loadRegionContext, loadVariantInfo } from '../context';
import type { PostStoreTintingQuoteType } from '../validators';

/**
 * POST /store/tinting/quote — precio de una base entonada con un color.
 *
 * Público (sólo publishable key, igual que el resto de /store): el PDP cotiza
 * antes de que exista un cliente logueado.
 *
 * A prueba de fallas, misma doctrina que el lookup de ARCA: NUNCA rethrow y toda
 * salida es JSON. Si el ERP no contesta, el PDP tiene que poder seguir vendiendo
 * la base sin entonar, así que la respuesta degradada trae `degraded: true` en
 * lugar de un 500.
 *
 * Códigos:
 * - 200 con el precio.
 * - 404 si la variante no existe o no tiene SKU (sin SKU no hay artículo en el ERP).
 * - 422 si esa combinación base+color no existe (o el ERP no la reconoce).
 * - 424 (no 503) si el ERP está caído: DO App Platform intercepta los 503 de la
 *   app y los reemplaza por su propia página de error, así que el cliente nunca
 *   vería nuestro JSON.
 */
export async function POST(
  req: MedusaRequest<PostStoreTintingQuoteType>,
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
    const cart = body.cart_id ? await loadCartContext(req, body.cart_id) : null;
    // Sin carrito (primer render del PDP) el país alcanza para resolver región y
    // moneda. Sin eso no hay precio de catálogo, y sin precio de catálogo no se
    // puede mostrar cuánto suma el entonado.
    const priceContext =
      cart ?? (body.country_code ? await loadRegionContext(req, body.country_code) : null);
    const variant = await loadVariantInfo(req, body.variant_id, priceContext);
    if (!variant?.sku) {
      res.status(404).json({ message: 'No encontramos esa base en el catálogo.' });
      return;
    }

    const { quote, selection, cached } = await quoteTinting(req.scope, {
      article_code: variant.sku,
      color_code: body.color_code,
      collection: body.collection ?? null,
      quantity: body.quantity,
      customer_group_ids: cart?.customer_group_ids ?? [],
      base_unit_price: variant.base_unit_price,
    });

    res.json({
      quote: {
        unit_price: quote.unit_price,
        line_total: quote.line_total,
        base_unit_price: variant.base_unit_price,
        tint_surcharge: quote.tint_surcharge,
        tax_rate: quote.tax_rate,
        quantity: quote.quantity,
        currency_code: priceContext?.currency_code ?? null,
      },
      color: {
        code: selection.color.code,
        name: selection.color.name,
        collection: selection.color.collection,
        hex: selection.color.hex,
      },
      cached,
      degraded: false,
    });
  } catch (error) {
    if (error instanceof TintingQuoteError) {
      if (error.reason === 'disabled') {
        res.status(404).json({ message: 'El sistema tintométrico no está disponible.' });
        return;
      }
      if (error.reason === 'unknown_selection' || error.reason === 'not_quotable') {
        res.status(422).json({ message: error.message, degraded: false });
        return;
      }
      res.status(424).json({
        message: 'No pudimos calcular el precio del color en este momento.',
        degraded: true,
      });
      return;
    }

    // Inesperado: el stack va a los logs del server, nunca al cliente, y se
    // degrada igual — este endpoint no puede tumbar el PDP.
    console.error('[tinting] quote error inesperado:', error instanceof Error ? error.stack : error);
    res.status(424).json({
      message: 'No pudimos calcular el precio del color en este momento.',
      degraded: true,
    });
  }
}
