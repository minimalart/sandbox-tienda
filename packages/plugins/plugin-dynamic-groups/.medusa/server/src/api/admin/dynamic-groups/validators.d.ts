import { z } from 'zod';
export declare const PostCreateDynamicGroup: z.ZodObject<{
    name: z.ZodString;
    handle: z.ZodOptional<z.ZodString>;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    match: z.ZodOptional<z.ZodEnum<{
        all: "all";
        any: "any";
    }>>;
    conditions: z.ZodDefault<z.ZodArray<z.ZodObject<{
        field: z.ZodString;
        operator: z.ZodEnum<{
            gte: "gte";
            lte: "lte";
            eq: "eq";
            neq: "neq";
            in: "in";
            contains: "contains";
        }>;
        value: z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodArray<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>]>;
        days: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>>;
    update_mode: z.ZodOptional<z.ZodEnum<{
        realtime: "realtime";
        manual: "manual";
    }>>;
    is_active: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export declare const PostUpdateDynamicGroup: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    handle: z.ZodOptional<z.ZodString>;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    match: z.ZodOptional<z.ZodEnum<{
        all: "all";
        any: "any";
    }>>;
    conditions: z.ZodOptional<z.ZodArray<z.ZodObject<{
        field: z.ZodString;
        operator: z.ZodEnum<{
            gte: "gte";
            lte: "lte";
            eq: "eq";
            neq: "neq";
            in: "in";
            contains: "contains";
        }>;
        value: z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodArray<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>]>;
        days: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>>;
    update_mode: z.ZodOptional<z.ZodEnum<{
        realtime: "realtime";
        manual: "manual";
    }>>;
    is_active: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export type PostCreateDynamicGroupInput = z.infer<typeof PostCreateDynamicGroup>;
export type PostUpdateDynamicGroupInput = z.infer<typeof PostUpdateDynamicGroup>;
