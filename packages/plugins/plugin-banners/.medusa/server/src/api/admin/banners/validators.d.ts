import { z } from 'zod';
export declare const PostAdminCreateBanner: z.ZodObject<{
    internal_name: z.ZodString;
    handle: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodOptional<z.ZodString>>;
    placement: z.ZodString;
    type: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodOptional<z.ZodString>>;
    device_type: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodOptional<z.ZodString>>;
    status: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodOptional<z.ZodEnum<{
        draft: "draft";
        published: "published";
        archived: "archived";
    }>>>;
    priority: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    content: z.ZodNullable<z.ZodOptional<z.ZodObject<{
        title: z.ZodOptional<z.ZodString>;
        subtitle: z.ZodOptional<z.ZodString>;
        body: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
    media: z.ZodNullable<z.ZodOptional<z.ZodObject<{
        url: z.ZodString;
        alt: z.ZodOptional<z.ZodString>;
        type: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            image: "image";
            video: "video";
        }>>>;
        aspect_ratio: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
    cta: z.ZodNullable<z.ZodOptional<z.ZodObject<{
        label: z.ZodOptional<z.ZodString>;
        url: z.ZodString;
        target: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            _self: "_self";
            _blank: "_blank";
        }>>>;
    }, z.core.$strip>>>;
    rules: z.ZodNullable<z.ZodOptional<z.ZodObject<{
        sales_channel_ids: z.ZodOptional<z.ZodArray<z.ZodString>>;
        customer_group_ids: z.ZodOptional<z.ZodArray<z.ZodString>>;
        locales: z.ZodOptional<z.ZodArray<z.ZodString>>;
        countries: z.ZodOptional<z.ZodArray<z.ZodString>>;
        devices: z.ZodOptional<z.ZodArray<z.ZodEnum<{
            mobile: "mobile";
            desktop: "desktop";
        }>>>;
        paths: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>>;
    start_at: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    end_at: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    metadata: z.ZodNullable<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
}, z.core.$strip>;
export declare const PostAdminUpdateBanner: z.ZodObject<{
    internal_name: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodOptional<z.ZodString>>;
    handle: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodOptional<z.ZodString>>;
    placement: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodOptional<z.ZodString>>;
    type: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodOptional<z.ZodString>>;
    device_type: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodOptional<z.ZodString>>;
    status: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodOptional<z.ZodEnum<{
        draft: "draft";
        published: "published";
        archived: "archived";
    }>>>;
    priority: z.ZodOptional<z.ZodNumber>;
    content: z.ZodNullable<z.ZodOptional<z.ZodObject<{
        title: z.ZodOptional<z.ZodString>;
        subtitle: z.ZodOptional<z.ZodString>;
        body: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
    media: z.ZodNullable<z.ZodOptional<z.ZodObject<{
        url: z.ZodString;
        alt: z.ZodOptional<z.ZodString>;
        type: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            image: "image";
            video: "video";
        }>>>;
        aspect_ratio: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
    cta: z.ZodNullable<z.ZodOptional<z.ZodObject<{
        label: z.ZodOptional<z.ZodString>;
        url: z.ZodString;
        target: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            _self: "_self";
            _blank: "_blank";
        }>>>;
    }, z.core.$strip>>>;
    rules: z.ZodNullable<z.ZodOptional<z.ZodObject<{
        sales_channel_ids: z.ZodOptional<z.ZodArray<z.ZodString>>;
        customer_group_ids: z.ZodOptional<z.ZodArray<z.ZodString>>;
        locales: z.ZodOptional<z.ZodArray<z.ZodString>>;
        countries: z.ZodOptional<z.ZodArray<z.ZodString>>;
        devices: z.ZodOptional<z.ZodArray<z.ZodEnum<{
            mobile: "mobile";
            desktop: "desktop";
        }>>>;
        paths: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>>;
    start_at: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    end_at: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    metadata: z.ZodNullable<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
}, z.core.$strip>;
