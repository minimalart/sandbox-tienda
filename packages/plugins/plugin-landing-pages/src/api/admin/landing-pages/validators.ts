import { z } from 'zod';
import { sanitizePuckData } from '../../../modules/landing-page/ai/puck-schema';

const seoSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  image: z.string().optional(),
  noindex: z.boolean().optional(),
});

// Puck's native document. Kept permissive (passthrough) so editor upgrades that
// add fields don't break persistence — the renderer maps known components only.
const puckDataSchema = z
  .object({
    content: z.array(z.any()).optional(),
    root: z.object({ props: z.record(z.string(), z.any()).optional() }).passthrough().optional(),
    zones: z.record(z.string(), z.any()).optional(),
  })
  .passthrough()
  // Endurecido: descarta componentes/props no permitidos y sanitiza strings,
  // sin romper landings existentes (sanitizePuckData nunca falla; normaliza y
  // preserva el id de Puck por bloque).
  .transform((val) => sanitizePuckData(val));

const statusSchema = z.enum(['draft', 'published', 'archived']);

// URL-safe slug: lowercase words separated by single hyphens.
const slugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be URL-safe (a-z, 0-9, hyphens)');

export const PostAdminCreateLandingPage = z.object({
  title: z.string().min(1, 'Title is required').trim(),
  slug: slugSchema.optional(),
  status: statusSchema.optional(),
  description: z.string().optional().nullable(),
  seo: seoSchema.optional().nullable(),
  puck_data: puckDataSchema.optional().nullable(),
  template: z.string().optional().nullable(),
  locale: z.string().optional().nullable(),
  sales_channel_id: z.string().optional().nullable(),
  metadata: z.record(z.string(), z.any()).optional().nullable(),
});

export const PostAdminUpdateLandingPage = z.object({
  title: z.string().min(1).trim().optional(),
  slug: slugSchema.optional(),
  status: statusSchema.optional(),
  description: z.string().optional().nullable(),
  seo: seoSchema.optional().nullable(),
  puck_data: puckDataSchema.optional().nullable(),
  template: z.string().optional().nullable(),
  locale: z.string().optional().nullable(),
  sales_channel_id: z.string().optional().nullable(),
  metadata: z.record(z.string(), z.any()).optional().nullable(),
});

export type PostAdminCreateLandingPageInput = z.infer<
  typeof PostAdminCreateLandingPage
>;
export type PostAdminUpdateLandingPageInput = z.infer<
  typeof PostAdminUpdateLandingPage
>;
