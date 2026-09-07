// Pure earn-rule evaluation, isolated from the DB for unit testing.

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
  now: number; // epoch ms
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

// Does an earn rule apply to this event context?
export function isRuleApplicable(rule: EvaluableRule, ctx: EarnContext): boolean {
  if (rule.status && rule.status !== 'active') return false;
  const c = rule.conditions ?? {};

  if (c.min_amount != null && ctx.amount < c.min_amount) return false;
  if (c.starts_at && ctx.now < Date.parse(c.starts_at)) return false;
  if (c.ends_at && ctx.now > Date.parse(c.ends_at)) return false;

  if (Array.isArray(c.sales_channel_ids) && c.sales_channel_ids.length) {
    if (!ctx.sales_channel_id || !c.sales_channel_ids.includes(ctx.sales_channel_id)) return false;
  }
  if (Array.isArray(c.customer_ids) && c.customer_ids.length) {
    if (!c.customer_ids.includes(ctx.customer_id)) return false;
  }

  // Catalog gates: if set, require at least one overlap with the order's items.
  const overlaps = (want?: string[], have?: string[]) =>
    !Array.isArray(want) || want.length === 0 || (have ?? []).some((id) => want.includes(id));
  if (!overlaps(c.category_ids, ctx.category_ids)) return false;
  if (!overlaps(c.collection_ids, ctx.collection_ids)) return false;
  if (!overlaps(c.brand_ids, ctx.brand_ids)) return false;

  return true;
}

// The multiplier from the highest-priority active campaign that affects a rule.
// `affected_rule_ids` empty/absent = affects all rules. Returns 1 if none apply.
export function pickCampaignMultiplier(
  campaigns: EvaluableCampaign[],
  ruleId: string,
  now: number,
): number {
  let mult = 1;
  let bestPriority = -Infinity;
  for (const cm of campaigns) {
    if (cm.status && cm.status !== 'active') continue;
    if (cm.starts_at && now < Date.parse(cm.starts_at)) continue;
    if (cm.ends_at && now > Date.parse(cm.ends_at)) continue;
    const list = cm.affected_rule_ids;
    const affects = !Array.isArray(list) || list.length === 0 || list.includes(ruleId);
    if (!affects) continue;
    const priority = cm.priority ?? 0;
    if (priority > bestPriority) {
      bestPriority = priority;
      mult = cm.multiplier && cm.multiplier > 0 ? cm.multiplier : 1;
    }
  }
  return mult > 0 ? mult : 1;
}

// Cap requested points by per-customer / per-day limits given already-earned totals.
export function capByLimits(
  limits: RuleLimits | null | undefined,
  requested: number,
  lifetimeEarned: number,
  todayEarned: number,
): number {
  let pts = requested;
  if (limits?.per_customer != null) {
    pts = Math.min(pts, Math.max(0, limits.per_customer - lifetimeEarned));
  }
  if (limits?.per_day != null) {
    pts = Math.min(pts, Math.max(0, limits.per_day - todayEarned));
  }
  return Math.max(0, pts);
}

export type ExpirationPolicy = { type?: 'none' | 'fixed_days' | 'end_of_year'; days?: number } | null;

// When points earned `now` should expire, per the program policy. null = never.
export function computeExpiryAt(policy: ExpirationPolicy, now: number): Date | null {
  if (!policy || !policy.type || policy.type === 'none') return null;
  if (policy.type === 'fixed_days' && policy.days && policy.days > 0) {
    return new Date(now + policy.days * 86_400_000);
  }
  if (policy.type === 'end_of_year') {
    const year = new Date(now).getUTCFullYear();
    return new Date(Date.UTC(year, 11, 31, 23, 59, 59));
  }
  return null;
}
