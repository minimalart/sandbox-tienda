type PromotionRuleValue = { value?: string };
type PromotionRule = {
  attribute?: string;
  operator?: string;
  values?: PromotionRuleValue[];
};
type PromotionShape = {
  rules?: PromotionRule[];
  application_method?: {
    target_rules?: PromotionRule[];
    buy_rules?: PromotionRule[];
  };
};

/**
 * Strict: require an explicit sales_channel_id rule whose values include
 * the active channel. Promotions without any sales_channel_id rule are
 * considered global and rejected — we only surface promos tied to this channel.
 */
export function promotionMatchesSalesChannel(
  promo: PromotionShape,
  salesChannelId: string,
): boolean {
  const ruleGroups: Array<PromotionRule[] | undefined> = [
    promo.rules,
    promo.application_method?.target_rules,
    promo.application_method?.buy_rules,
  ];

  let hasChannelRule = false;

  for (const rules of ruleGroups) {
    const channelRule = rules?.find((r) => r.attribute === "sales_channel_id");
    if (!channelRule) continue;

    hasChannelRule = true;

    const allowedValues = (channelRule.values ?? [])
      .map((v) => v.value)
      .filter((v): v is string => Boolean(v));

    if (allowedValues.length === 0) return false;

    const operator = channelRule.operator ?? "in";
    const included = allowedValues.includes(salesChannelId);
    if (operator === "not_in") {
      if (included) return false;
    } else if (!included) {
      return false;
    }
  }

  return hasChannelRule;
}
