import { z } from 'zod';

/**
 * Un binding asigna un evento de notificación (`key`) a un template de Kapso y
 * define el orden de sus variables (`params`: nombres de campos del evento que
 * llenan {{1}}, {{2}}…). Solo los `published` se usan al enviar.
 */
export const SaveBindingSchema = z.object({
  key: z.string().min(1, 'El evento es obligatorio'),
  template_name: z.string().min(1, 'El template es obligatorio'),
  language: z.string().min(2).default('es'),
  params: z.array(z.string()).default([]),
  status: z.enum(['draft', 'published']).default('draft'),
});

export type SaveBindingInput = z.infer<typeof SaveBindingSchema>;
