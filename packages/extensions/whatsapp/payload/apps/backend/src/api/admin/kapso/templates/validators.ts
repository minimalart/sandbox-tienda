import { z } from 'zod';

/**
 * Validación de creación de template. El `name` sigue las reglas de Meta
 * (minúsculas, números y guión bajo). Los `components` se pasan tal cual a la
 * Cloud API (BODY/HEADER/FOOTER/BUTTONS); acá solo garantizamos que haya al menos
 * uno y que `name`/`language`/`category` sean válidos.
 */
export const CreateKapsoTemplateSchema = z.object({
  name: z
    .string()
    .min(1, 'El nombre es obligatorio')
    .regex(/^[a-z0-9_]+$/, 'Solo minúsculas, números y guión bajo (sin espacios)'),
  language: z.string().min(2, 'Idioma inválido').default('es'),
  category: z.enum(['UTILITY', 'MARKETING', 'AUTHENTICATION']).default('UTILITY'),
  components: z
    .array(z.record(z.string(), z.unknown()))
    .min(1, 'Se requiere al menos un componente (ej. BODY)'),
});

export type CreateKapsoTemplateInput = z.infer<typeof CreateKapsoTemplateSchema>;

/**
 * Validación de edición de un template EXISTENTE. Meta identifica la plantilla a
 * editar por su `id` (no por nombre), y solo admite cambiar `category` y/o
 * `components` — el nombre y el idioma son inmutables, por eso no se aceptan acá.
 */
export const UpdateKapsoTemplateSchema = z.object({
  id: z.string().min(1, 'Falta el id de la plantilla de Meta'),
  category: z.enum(['UTILITY', 'MARKETING', 'AUTHENTICATION']).optional(),
  components: z
    .array(z.record(z.string(), z.unknown()))
    .min(1, 'Se requiere al menos un componente (ej. BODY)')
    .optional(),
});

export type UpdateKapsoTemplateInput = z.infer<typeof UpdateKapsoTemplateSchema>;
