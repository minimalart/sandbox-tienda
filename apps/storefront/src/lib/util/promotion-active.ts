export type PromotionCampaignBudgetState = {
  limit?: number | string | { value?: string | number | null } | null;
  used?: number | string | { value?: string | number | null } | null;
} | null;

export type PromotionCampaignState =
  | {
      status?: string | null;
      is_active?: boolean | null;
      starts_at?: string | Date | null;
      ends_at?: string | Date | null;
      deleted_at?: string | Date | null;
      budget?: PromotionCampaignBudgetState;
      [key: string]: unknown;
    }
  | null
  | undefined;

export type PromotionWithCampaignState =
  | {
      status?: string | null;
      campaign?: PromotionCampaignState;
      [key: string]: unknown;
    }
  | null
  | undefined;

function readTimestamp(value: string | Date | null | undefined): number | null {
  if (!value) return null;
  const timestamp = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function readNumber(
  value:
    | number
    | string
    | { value?: string | number | null }
    | null
    | undefined,
): number | null {
  if (value === null || value === undefined) return null;
  const rawValue =
    typeof value === "object" && "value" in value ? value.value : value;
  if (rawValue === null || rawValue === undefined || rawValue === "") {
    return null;
  }

  const numeric = Number(rawValue);
  return Number.isFinite(numeric) ? numeric : null;
}

export function isCampaignActiveForStorefront(
  campaign: PromotionCampaignState,
  now: Date = new Date(),
): boolean {
  if (!campaign) return true;
  if (campaign.deleted_at) return false;
  if (campaign.is_active === false) return false;

  const status = campaign.status?.toLowerCase();
  if (status && status !== "active") return false;

  const nowTimestamp = now.getTime();
  const startsAt = readTimestamp(campaign.starts_at);
  if (startsAt !== null && startsAt > nowTimestamp) return false;

  const endsAt = readTimestamp(campaign.ends_at);
  if (endsAt !== null && endsAt <= nowTimestamp) return false;

  const limit = readNumber(campaign.budget?.limit);
  const used = readNumber(campaign.budget?.used);
  if (limit !== null && used !== null && used >= limit) return false;

  return true;
}

export function isPromotionActiveForStorefront(
  promotion: PromotionWithCampaignState,
  now: Date = new Date(),
): boolean {
  if (!promotion) return false;

  const status = promotion.status?.toLowerCase();
  if (status && status !== "active") return false;

  return isCampaignActiveForStorefront(promotion.campaign ?? null, now);
}
