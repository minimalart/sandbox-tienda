import { z } from 'zod';
export declare const GiftCardDesignInput: z.ZodObject<{
    public_id: z.ZodString;
    name: z.ZodString;
    occasion: z.ZodEnum<{
        general: "general";
        birthday: "birthday";
        thanks: "thanks";
        congratulations: "congratulations";
        holidays: "holidays";
        brand: "brand";
    }>;
    desktop_image_url: z.ZodString;
    mobile_image_url: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    text_color: z.ZodString;
    content_position: z.ZodEnum<{
        top_left: "top_left";
        top_center: "top_center";
        top_right: "top_right";
        center_left: "center_left";
        center: "center";
        center_right: "center_right";
        bottom_left: "bottom_left";
        bottom_center: "bottom_center";
        bottom_right: "bottom_right";
    }>;
    active: z.ZodDefault<z.ZodBoolean>;
    sort_order: z.ZodDefault<z.ZodNumber>;
}, z.core.$strict>;
export declare const GiftCardDesignUpdate: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    occasion: z.ZodOptional<z.ZodEnum<{
        general: "general";
        birthday: "birthday";
        thanks: "thanks";
        congratulations: "congratulations";
        holidays: "holidays";
        brand: "brand";
    }>>;
    desktop_image_url: z.ZodOptional<z.ZodString>;
    mobile_image_url: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    text_color: z.ZodOptional<z.ZodString>;
    content_position: z.ZodOptional<z.ZodEnum<{
        top_left: "top_left";
        top_center: "top_center";
        top_right: "top_right";
        center_left: "center_left";
        center: "center";
        center_right: "center_right";
        bottom_left: "bottom_left";
        bottom_center: "bottom_center";
        bottom_right: "bottom_right";
    }>>;
    active: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    sort_order: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
}, z.core.$strict>;
export declare const GiftCardDeliveryUpdate: z.ZodObject<{
    recipient_email: z.ZodString;
}, z.core.$strict>;
export declare const GiftCardSettingsUpdate: z.ZodObject<{
    enabled: z.ZodOptional<z.ZodBoolean>;
    timezone: z.ZodOptional<z.ZodString>;
    morning_time: z.ZodOptional<z.ZodString>;
    afternoon_time: z.ZodOptional<z.ZodString>;
    evening_time: z.ZodOptional<z.ZodString>;
    schedule_horizon_days: z.ZodOptional<z.ZodNumber>;
    default_expiry_days: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    default_design_id: z.ZodOptional<z.ZodString>;
    retry_delays_minutes: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
    fallback_to_buyer: z.ZodOptional<z.ZodBoolean>;
    balance_reminder_days: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    expiring_notice_days: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    legal_text: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    terms_url: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    merchandising_url: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strict>;
