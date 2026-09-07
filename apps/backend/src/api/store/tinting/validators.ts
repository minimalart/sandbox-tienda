import { z } from 'zod';

/**
 * `quantity` es un ENTERO por contrato del ERP: `formulaTintometrico` cotiza por
 * cantidad de ENVASES y rechaza decimales (`1.0` → 400 `For input string`). El
 * tope duro de 200 es anti-abuso; el tope real, configurable por demo, lo aplica
 * la ruta con `tinting.max_quantity` (default 12).
 */
const quantity = z.number().int().min(1).max(200);
const colorCode = z.string().trim().min(1).max(120);
const collection = z.string().trim().max(120).optional();

export const PostStoreTintingQuote = z.object({
  variant_id: z.string().min(1),
  color_code: colorCode,
  collection,
  quantity: quantity.default(1),
  /**
   * Da el contexto de precios (región, moneda y grupos del cliente) para
   * desglosar el sobreprecio y para que el mayorista cotice con SU lista. Sin
   * carrito la cotización igual es correcta: el `total` de Zeus no depende de
   * nuestra región, sólo de `lista`.
   */
  cart_id: z.string().min(1).optional(),
  /**
   * Alternativa al carrito para el contexto de precios: en el primer render del
   * PDP todavía no hay carrito, y sin región no hay precio de catálogo, así que
   * el desglose "+ X de entonado" no se podía mostrar. El país sí lo sabe el
   * storefront siempre (está en la URL).
   */
  country_code: z.string().trim().min(2).max(4).optional(),
});
export type PostStoreTintingQuoteType = z.infer<typeof PostStoreTintingQuote>;

export const PostStoreTintingLineItem = z.object({
  cart_id: z.string().min(1),
  variant_id: z.string().min(1),
  color_code: colorCode,
  collection,
  quantity: quantity.default(1),
});
export type PostStoreTintingLineItemType = z.infer<typeof PostStoreTintingLineItem>;
