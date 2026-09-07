import { z } from 'zod';
export declare const PostAdminCreateCheckoutLink: z.ZodObject<{
    internal_name: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodOptional<z.ZodString>>;
    items: z.ZodArray<z.ZodObject<{
        variant_id: z.ZodString;
        quantity: z.ZodNumber;
    }, z.core.$strip>>;
    country_code: z.ZodString;
    region_id: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodOptional<z.ZodString>>;
    sales_channel_id: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodOptional<z.ZodString>>;
    email: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodOptional<z.ZodString>>;
    customer_id: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodOptional<z.ZodString>>;
    shipping_address: z.ZodNullable<z.ZodOptional<z.ZodObject<{
        first_name: z.ZodOptional<z.ZodString>;
        last_name: z.ZodOptional<z.ZodString>;
        address_1: z.ZodOptional<z.ZodString>;
        address_2: z.ZodOptional<z.ZodString>;
        company: z.ZodOptional<z.ZodString>;
        postal_code: z.ZodOptional<z.ZodString>;
        city: z.ZodOptional<z.ZodString>;
        country_code: z.ZodOptional<z.ZodString>;
        province: z.ZodOptional<z.ZodString>;
        phone: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
    promo_codes: z.ZodNullable<z.ZodOptional<z.ZodArray<z.ZodString>>>;
    single_use: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    expires_at: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    metadata: z.ZodNullable<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
}, z.core.$strip>;
export declare const PostAdminUpdateCheckoutLink: z.ZodObject<{
    internal_name: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodOptional<z.ZodString>>;
    items: z.ZodOptional<z.ZodArray<z.ZodObject<{
        variant_id: z.ZodString;
        quantity: z.ZodNumber;
    }, z.core.$strip>>>;
    country_code: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodOptional<z.ZodString>>;
    region_id: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodOptional<z.ZodString>>;
    sales_channel_id: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodOptional<z.ZodString>>;
    email: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    customer_id: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    shipping_address: z.ZodNullable<z.ZodOptional<z.ZodObject<{
        first_name: z.ZodOptional<z.ZodString>;
        last_name: z.ZodOptional<z.ZodString>;
        address_1: z.ZodOptional<z.ZodString>;
        address_2: z.ZodOptional<z.ZodString>;
        company: z.ZodOptional<z.ZodString>;
        postal_code: z.ZodOptional<z.ZodString>;
        city: z.ZodOptional<z.ZodString>;
        country_code: z.ZodOptional<z.ZodString>;
        province: z.ZodOptional<z.ZodString>;
        phone: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
    promo_codes: z.ZodNullable<z.ZodOptional<z.ZodArray<z.ZodString>>>;
    status: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodOptional<z.ZodEnum<{
        active: "active";
        used: "used";
        disabled: "disabled";
    }>>>;
    single_use: z.ZodOptional<z.ZodBoolean>;
    expires_at: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    metadata: z.ZodNullable<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
}, z.core.$strip>;
