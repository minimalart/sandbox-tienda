import { z } from 'zod';

/**
 * Validadores de las rutas store del motor de recomendaciones.
 *
 * Los topes de tamaño no son cosmética: este endpoint es público y el `context`
 * viaja en el body. Un `product_ids` de 10.000 elementos (vistos recientemente)
 * generaría una query de candidatos gigante, así que se acota acá y no adentro.
 */

const id = z.string().trim().min(1).max(120);

const ServeContextSchema = z
  .object({
    target_price: z.coerce.number().nonnegative().optional(),
    price_min: z.coerce.number().nonnegative().optional(),
    price_max: z.coerce.number().nonnegative().optional(),
    product_ids: z.array(id).max(60).optional(),
    exclude_product_ids: z.array(id).max(60).optional(),
    currency_code: z.string().trim().min(2).max(6).optional(),
  })
  .strict();

export const PostStoreRecommendations = z
  .object({
    placement: z.string().trim().min(1).max(80),
    product_id: id.optional(),
    cart_id: id.optional(),
    customer_id: id.optional(),
    session_id: id.optional(),
    sales_channel_id: id.optional(),
    region_id: id.optional(),
    limit: z.coerce.number().int().positive().max(50).optional(),
    context: ServeContextSchema.optional(),
  })
  .strict();

export type PostStoreRecommendationsInput = z.infer<typeof PostStoreRecommendations>;

/**
 * Eventos del embudo. Sólo los tres que puede reportar el cliente: `served` y
 * `purchased` los escribe el backend, y aceptarlos acá permitiría inventar compras.
 *
 * El lote existe porque el storefront agrupa eventos en una ventana corta y los manda
 * de una: sin lote, cada tarjeta vista sería un request.
 */
const IncomingEventSchema = z
  .object({
    event: z.enum([
      'recommendation_viewed',
      'recommendation_clicked',
      'recommendation_added_to_cart',
    ]),
    product_id: id,
    position: z.coerce.number().int().nonnegative().max(500).optional(),
    quantity: z.coerce.number().int().positive().max(10_000).optional(),
    occurred_at: z.string().trim().min(1).max(40).optional(),
  })
  .strict();

export const PostStoreRecommendationEvents = z
  .object({
    request_id: z.string().trim().min(1).max(120),
    events: z.array(IncomingEventSchema).min(1).max(60),
  })
  .strict();

export type PostStoreRecommendationEventsInput = z.infer<typeof PostStoreRecommendationEvents>;
