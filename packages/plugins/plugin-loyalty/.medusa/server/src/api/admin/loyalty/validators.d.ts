import { z } from 'zod';
export declare const CreateProgramSchema: z.ZodObject<{
    name: z.ZodString;
    status: z.ZodOptional<z.ZodEnum<{
        active: "active";
        inactive: "inactive";
    }>>;
    points_name: z.ZodOptional<z.ZodString>;
    currency_code: z.ZodOptional<z.ZodString>;
    starts_at: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    ends_at: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    expiration_policy: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodAny>>>;
    config: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodAny>>>;
}, z.core.$strip>;
export declare const UpdateProgramSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodOptional<z.ZodEnum<{
        active: "active";
        inactive: "inactive";
    }>>>;
    points_name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    currency_code: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    starts_at: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    ends_at: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    expiration_policy: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodAny>>>>;
    config: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodAny>>>>;
}, z.core.$strip>;
export declare const CreateRuleSchema: z.ZodObject<{
    program_id: z.ZodString;
    name: z.ZodString;
    status: z.ZodOptional<z.ZodEnum<{
        active: "active";
        inactive: "inactive";
    }>>;
    priority: z.ZodOptional<z.ZodNumber>;
    event: z.ZodEnum<{
        purchase: "purchase";
        signup: "signup";
        first_purchase: "first_purchase";
        order_delivered: "order_delivered";
        birthday: "birthday";
        referral: "referral";
        comment: "comment";
    }>;
    calc_type: z.ZodEnum<{
        fixed: "fixed";
        percentage: "percentage";
        multiplier: "multiplier";
    }>;
    calc_value: z.ZodNumber;
    conditions: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodAny>>>;
    limits: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodAny>>>;
}, z.core.$strip>;
export declare const UpdateRuleSchema: z.ZodObject<{
    program_id: z.ZodOptional<z.ZodString>;
    name: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodOptional<z.ZodEnum<{
        active: "active";
        inactive: "inactive";
    }>>>;
    priority: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    event: z.ZodOptional<z.ZodEnum<{
        purchase: "purchase";
        signup: "signup";
        first_purchase: "first_purchase";
        order_delivered: "order_delivered";
        birthday: "birthday";
        referral: "referral";
        comment: "comment";
    }>>;
    calc_type: z.ZodOptional<z.ZodEnum<{
        fixed: "fixed";
        percentage: "percentage";
        multiplier: "multiplier";
    }>>;
    calc_value: z.ZodOptional<z.ZodNumber>;
    conditions: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodAny>>>>;
    limits: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodAny>>>>;
}, z.core.$strip>;
export declare const CreateRewardSchema: z.ZodObject<{
    program_id: z.ZodString;
    name: z.ZodString;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    image_url: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    cost_points: z.ZodNumber;
    type: z.ZodEnum<{
        store_credit: "store_credit";
        fixed_discount: "fixed_discount";
        percent_discount: "percent_discount";
        free_shipping: "free_shipping";
        free_product: "free_product";
        custom: "custom";
    }>;
    config: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodAny>>>;
    stock: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    valid_from: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    valid_to: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    segments: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodAny>>>;
    status: z.ZodOptional<z.ZodEnum<{
        active: "active";
        inactive: "inactive";
    }>>;
}, z.core.$strip>;
export declare const UpdateRewardSchema: z.ZodObject<{
    program_id: z.ZodOptional<z.ZodString>;
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    image_url: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    cost_points: z.ZodOptional<z.ZodNumber>;
    type: z.ZodOptional<z.ZodEnum<{
        store_credit: "store_credit";
        fixed_discount: "fixed_discount";
        percent_discount: "percent_discount";
        free_shipping: "free_shipping";
        free_product: "free_product";
        custom: "custom";
    }>>;
    config: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodAny>>>>;
    stock: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
    valid_from: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    valid_to: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    segments: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodAny>>>>;
    status: z.ZodOptional<z.ZodOptional<z.ZodEnum<{
        active: "active";
        inactive: "inactive";
    }>>>;
}, z.core.$strip>;
export declare const CreateTierSchema: z.ZodObject<{
    program_id: z.ZodString;
    name: z.ZodString;
    condition_type: z.ZodOptional<z.ZodEnum<{
        points: "points";
        spend: "spend";
        orders: "orders";
    }>>;
    threshold: z.ZodOptional<z.ZodNumber>;
    multiplier: z.ZodOptional<z.ZodNumber>;
    benefits: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodAny>>>;
}, z.core.$strip>;
export declare const UpdateTierSchema: z.ZodObject<{
    program_id: z.ZodOptional<z.ZodString>;
    name: z.ZodOptional<z.ZodString>;
    condition_type: z.ZodOptional<z.ZodOptional<z.ZodEnum<{
        points: "points";
        spend: "spend";
        orders: "orders";
    }>>>;
    threshold: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    multiplier: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    benefits: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodAny>>>>;
}, z.core.$strip>;
export declare const CreateCampaignSchema: z.ZodObject<{
    program_id: z.ZodString;
    name: z.ZodString;
    status: z.ZodOptional<z.ZodEnum<{
        active: "active";
        inactive: "inactive";
    }>>;
    starts_at: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    ends_at: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    multiplier: z.ZodOptional<z.ZodNumber>;
    affected_rule_ids: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>;
    limits: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodAny>>>;
    priority: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export declare const UpdateCampaignSchema: z.ZodObject<{
    program_id: z.ZodOptional<z.ZodString>;
    name: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodOptional<z.ZodEnum<{
        active: "active";
        inactive: "inactive";
    }>>>;
    starts_at: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    ends_at: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    multiplier: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    affected_rule_ids: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>>;
    limits: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodAny>>>>;
    priority: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
}, z.core.$strip>;
