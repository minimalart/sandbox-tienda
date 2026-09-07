import { z } from 'zod';
/**
 * POST /admin/fiscal-documents — consulta ARCA para un CUIT y genera una
 * constancia versionada asociada a la empresa (corporate | company).
 */
export declare const PostFiscalDocument: z.ZodObject<{
    owner_type: z.ZodEnum<{
        corporate: "corporate";
        company: "company";
    }>;
    owner_id: z.ZodString;
    cuit: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
}, z.core.$strip>;
export type PostFiscalDocumentType = z.infer<typeof PostFiscalDocument>;
/** GET /admin/fiscal-documents?owner_type=&owner_id= — lista por owner. */
export declare const ListFiscalDocumentsQuery: z.ZodObject<{
    owner_type: z.ZodEnum<{
        corporate: "corporate";
        company: "company";
    }>;
    owner_id: z.ZodString;
}, z.core.$strip>;
export type ListFiscalDocumentsQueryType = z.infer<typeof ListFiscalDocumentsQuery>;
