import { z } from 'zod';
export declare const RedeemSchema: z.ZodObject<{
    reward_id: z.ZodString;
    sales_channel_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
