import { z } from 'zod';

/**
 * El interruptor del bot. `enabled: false` = el número deja de contestar solo y
 * toda conversación queda para una persona en el inbox.
 *
 * La nota es opcional y para humanos: es lo que después explica por qué el bot de
 * una tienda lleva tres semanas apagado.
 */
export const UpdateBotSwitchSchema = z.object({
  enabled: z.boolean(),
  note: z.string().max(280).optional().nullable(),
});

export type UpdateBotSwitchInput = z.infer<typeof UpdateBotSwitchSchema>;
