import { z } from 'zod';

/**
 * Canales de venta que atiende el bot. `sales_channel_ids` es la lista COMPLETA,
 * no un patch: mandar `[]` significa "sin configurar" (el bot cae a la env o al
 * canal por defecto), y es la única forma de deseleccionar el último canal.
 *
 * El ORDEN importa: el primero es el canal principal (el del pedido).
 */
export const UpdateBotChannelsSchema = z.object({
  sales_channel_ids: z.array(z.string().min(1).max(64)).max(10),
});

export type UpdateBotChannelsInput = z.infer<typeof UpdateBotChannelsSchema>;
