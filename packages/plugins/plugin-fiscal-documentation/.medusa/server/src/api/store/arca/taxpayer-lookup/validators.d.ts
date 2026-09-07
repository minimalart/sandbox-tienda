import { z } from 'zod';
export declare const PostArcaTaxpayerLookup: z.ZodObject<{
    cuit: z.ZodString;
}, z.core.$strip>;
export type PostArcaTaxpayerLookupType = z.infer<typeof PostArcaTaxpayerLookup>;
