import { z } from 'zod';
import { invalidRecipients, parseRecipientList } from '../../../lib/recipient-list';

const statusSchema = z.enum(['draft', 'published']);

// Template key: lowercase words separated by hyphens (app keys, e.g.
// "order-cancelled") or dots (Medusa event names, e.g. "order.placed").
const keySchema = z
  .string()
  .regex(
    /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/,
    'Key must be lowercase a-z, 0-9, hyphens or dots',
  );

const variableSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

/**
 * `site_id` — la tienda dueña de la plantilla. `null` explícito = GLOBAL.
 *
 * NO ESTABA, y esa ausencia era la mitad admin de un bug de envío. zod borra del body
 * todo lo que el schema no declara, así que un `site_id` mandado desde el admin se
 * descartaba EN SILENCIO: la ruta de alta aplicaba `siteDefaults` de la request y no
 * había ninguna forma de crear una plantilla global ni de convertir una en global. La
 * global es justamente la ÚNICA que los ~10 emisores sin eje pueden leer —el reseteo
 * de contraseña arriba de todo, cuyo evento trae `{ entity_id, token, actor_type }` y
 * nada más—, o sea que la única plantilla que el path de reseteo alcanzaba era
 * precisamente la que el admin no podía producir. Ver `lib/multistore/job-scope.ts`.
 *
 * `.nullable()` es la pieza que importa y no es cosmética: el schema tiene que
 * distinguir TRES cosas, no dos.
 *   - campo ausente  → no tocar el eje (un PATCH parcial)
 *   - `null`         → GLOBAL, la usan todas las tiendas sin la suya
 *   - `"demo_x"`     → esa tienda
 * Con `.optional()` solo, `null` sería un error de validación y "global" quedaría
 * inexpresable — que es el estado en el que estábamos.
 *
 * QUIÉN puede escribir QUÉ valor NO se decide acá. Un schema no tiene la tienda de la
 * request en la mano, y sin eso "aceptar `site_id`" sería dejar que el operador de la
 * tienda A escriba la plantilla de la B. Eso lo arbitra `assertWritableSiteId`
 * (`lib/multistore/scope.ts`) en cada ruta.
 */
const siteIdSchema = z
  .string()
  .min(1, 'site_id no puede ser una cadena vacía: para "global" mandá null')
  .nullable();

export const PostAdminCreateEmailTemplate = z.object({
  site_id: siteIdSchema.optional(),
  key: keySchema.optional(),
  name: z.string().min(1, 'Name is required').trim(),
  description: z.string().optional().nullable(),
  subject: z.string().min(1, 'Subject is required'),
  html: z.string().min(1, 'HTML is required'),
  design: z.record(z.string(), z.any()).optional().nullable(),
  status: statusSchema.optional(),
  locale: z.string().optional().nullable(),
  variables: z.array(variableSchema).optional().nullable(),
  sample_data: z.record(z.string(), z.any()).optional().nullable(),
  metadata: z.record(z.string(), z.any()).optional().nullable(),
});

export const PostAdminUpdateEmailTemplate = z.object({
  site_id: siteIdSchema.optional(),
  key: keySchema.optional(),
  name: z.string().min(1).trim().optional(),
  description: z.string().optional().nullable(),
  subject: z.string().min(1).optional(),
  html: z.string().optional(),
  design: z.record(z.string(), z.any()).optional().nullable(),
  status: statusSchema.optional(),
  locale: z.string().optional().nullable(),
  variables: z.array(variableSchema).optional().nullable(),
  sample_data: z.record(z.string(), z.any()).optional().nullable(),
  metadata: z.record(z.string(), z.any()).optional().nullable(),
});

// Test send / preview share an optional data override (falls back to sample_data).
export const PostAdminTestSendEmailTemplate = z.object({
  /**
   * UNA casilla o VARIAS separadas por coma: el modal PRELLENA este campo con el
   * `admin_notification_email` de la tienda, que desde que los avisos internos
   * aceptan varios destinatarios puede ser una lista. Con `z.string().email()`
   * acá, abrir "Enviar prueba" y apretar enviar sin tocar nada fallaba con "A
   * valid recipient email is required" sobre direcciones todas válidas.
   */
  to: z
    .string()
    .min(1, 'A valid recipient email is required')
    .superRefine((value, ctx) => {
      const bad = invalidRecipients(value);
      const parsed = parseRecipientList(value);
      if (bad.length === 0 && parsed.length > 0) return;
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: bad.length
          ? `A valid recipient email is required: "${bad[0]}" is not one`
          : 'A valid recipient email is required',
      });
    }),
  data: z.record(z.string(), z.any()).optional().nullable(),
});

export const PostAdminPreviewEmailTemplate = z.object({
  subject: z.string().optional(),
  html: z.string().optional(),
  // Puck document — when present it is rendered to HTML (React Email) before the
  // Handlebars pass, so the preview reflects unsaved block edits.
  design: z.record(z.string(), z.any()).optional().nullable(),
  data: z.record(z.string(), z.any()).optional().nullable(),
});

export type PostAdminCreateEmailTemplateInput = z.infer<
  typeof PostAdminCreateEmailTemplate
>;
export type PostAdminUpdateEmailTemplateInput = z.infer<
  typeof PostAdminUpdateEmailTemplate
>;
