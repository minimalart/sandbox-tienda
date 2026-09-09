import { z } from 'zod';

const positiveInteger = z.number().int().positive().max(1000000);
export const presentationSchema = z
  .object({
    label: z.string().max(100).optional(),
    mode: z.enum(['informational', 'grouping', 'own-sku']).default('informational'),
    unitsPerPackage: positiveInteger.optional(),
    priceBasis: z.enum(['unit', 'sku']).optional(),
  })
  .strict();
export const purchasePolicySchema = z
  .object({
    enabled: z.boolean().default(false),
    minQuantity: positiveInteger.optional(),
    quantityStep: positiveInteger.optional(),
    allowedModes: z.array(z.enum(['unit', 'package'])).optional(),
  })
  .strict();
export const connectionConfigSchema = z
  .object({
    provider: z.enum(['vtex', 'woocommerce', 'shopify']),
    sourceUrl: z
      .string()
      .url()
      .max(500)
      .refine((value) => {
        const url = new URL(value);
        return (
          url.protocol === 'https:' &&
          !url.username &&
          !url.password &&
          !url.search &&
          !url.hash &&
          url.pathname === '/'
        );
      }, 'Ingresá sólo el origen HTTPS, sin credenciales ni parámetros.'),
    currencyCode: z
      .string()
      .regex(/^[a-zA-Z]{3}$/)
      .transform((v) => v.toLowerCase()),
    priceTaxIncluded: z.boolean().optional(),
    searchStrategy: z.enum(['auto', 'intelligent-search', 'legacy']).default('auto'),
    sellerRef: z.string().min(1).max(100).optional(),
    sourceChannel: z.string().min(1).max(100).optional(),
    inventoryMode: z.enum(['ignore', 'availability-only']).default('ignore'),
    targetCount: z.number().int().positive().max(50000).optional(),
    fieldMapping: z
      .object({
        unitsPerPackage: z.string().min(1).max(100).optional(),
        label: z.string().min(1).max(100).optional(),
      })
      .strict()
      .default({}),
    presentation: presentationSchema.optional(),
    purchasePolicy: purchasePolicySchema.default({ enabled: false }),
    protectedFields: z
      .array(
        z.enum([
          'title',
          'description',
          'images',
          'categories',
          'price',
          'listAmount',
          'presentation',
          'purchasePolicy',
        ])
      )
      .default([]),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.purchasePolicy.enabled && value.purchasePolicy.allowedModes?.includes('package')) {
      const p = value.presentation;
      if (
        !p ||
        p.mode === 'informational' ||
        (p.mode === 'grouping' &&
          (p.priceBasis !== 'unit' ||
            (!p.unitsPerPackage && !value.fieldMapping.unitsPerPackage))) ||
        (p.mode === 'own-sku' && p.priceBasis !== 'sku')
      ) {
        ctx.addIssue({
          code: 'custom',
          message:
            'Confirmá el modo, la equivalencia y la base de precio antes de habilitar bultos.',
          path: ['presentation'],
        });
      }
    }
  });
export type ConnectionConfig = z.infer<typeof connectionConfigSchema>;
