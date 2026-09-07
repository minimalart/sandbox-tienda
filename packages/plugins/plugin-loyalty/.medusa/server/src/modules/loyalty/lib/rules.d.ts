export type RuleConditions = {
    min_amount?: number;
    sales_channel_ids?: string[];
    customer_ids?: string[];
    category_ids?: string[];
    collection_ids?: string[];
    brand_ids?: string[];
    starts_at?: string;
    ends_at?: string;
};
export type RuleLimits = {
    per_customer?: number;
    per_day?: number;
    per_campaign?: number;
};
export type EvaluableRule = {
    id: string;
    status?: string;
    conditions?: RuleConditions | null;
};
export type EarnContext = {
    amount: number;
    customer_id: string;
    now: number;
    sales_channel_id?: string | null;
    category_ids?: string[];
    collection_ids?: string[];
    brand_ids?: string[];
};
export type EvaluableCampaign = {
    id: string;
    status?: string;
    multiplier?: number;
    priority?: number;
    affected_rule_ids?: string[] | null;
    starts_at?: string | null;
    ends_at?: string | null;
};
export declare function isRuleApplicable(rule: EvaluableRule, ctx: EarnContext): boolean;
export declare function pickCampaignMultiplier(campaigns: EvaluableCampaign[], ruleId: string, now: number): number;
export declare function capByLimits(limits: RuleLimits | null | undefined, requested: number, lifetimeEarned: number, todayEarned: number): number;
export type ExpirationPolicy = {
    type?: 'none' | 'fixed_days' | 'end_of_year';
    days?: number;
} | null;
export declare function computeExpiryAt(policy: ExpirationPolicy, now: number): Date | null;
