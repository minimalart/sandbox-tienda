import { z } from 'zod';
import { validateCuit } from '../../../lib/cuit';

/**
 * POST /admin/fiscal-documents — consulta ARCA para un CUIT y genera una
 * constancia versionada asociada a la empresa (corporate | company).
 */
export const PostFiscalDocument = z.object({
  owner_type: z.enum(['corporate', 'company']),
  owner_id: z.string().min(1, 'owner_id es requerido'),
  cuit: z
    .string()
    .transform((v) => v.replace(/\D/g, ''))
    .refine(validateCuit, 'CUIT inválido (revisá los 11 dígitos y el verificador).'),
});

export type PostFiscalDocumentType = z.infer<typeof PostFiscalDocument>;

/** GET /admin/fiscal-documents?owner_type=&owner_id= — lista por owner. */
export const ListFiscalDocumentsQuery = z.object({
  owner_type: z.enum(['corporate', 'company']),
  owner_id: z.string().min(1, 'owner_id es requerido'),
});

export type ListFiscalDocumentsQueryType = z.infer<typeof ListFiscalDocumentsQuery>;
