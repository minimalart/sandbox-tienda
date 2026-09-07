import { z } from 'zod';

/**
 * Patch de la config del botón flotante de WhatsApp del storefront. Todos los
 * campos son opcionales: el card del admin guarda de a un campo (el toggle
 * escribe solo `enabled`) y el backend mergea sobre lo ya persistido.
 */
export const UpdateFloatingButtonSchema = z.object({
  enabled: z.boolean().optional(),
  // Se acepta como lo escriba el operador (+54 9 11 …): el backend normaliza a
  // dígitos. `''` es válido y significa "sin teléfono" (el botón no se muestra).
  phone: z.string().max(40).optional(),
  message: z.string().max(400).optional(),
  label: z.string().max(80).optional(),
});

export type UpdateFloatingButtonInput = z.infer<typeof UpdateFloatingButtonSchema>;
