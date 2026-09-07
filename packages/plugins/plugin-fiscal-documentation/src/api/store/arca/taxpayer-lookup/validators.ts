import { z } from 'zod';
import { validateCuit } from '../../../../lib/cuit';

export const PostArcaTaxpayerLookup = z.object({
  cuit: z
    .string()
    .refine(validateCuit, 'CUIT inválido (revisá los 11 dígitos y el verificador).'),
});

export type PostArcaTaxpayerLookupType = z.infer<typeof PostArcaTaxpayerLookup>;
