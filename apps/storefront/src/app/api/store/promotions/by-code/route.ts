import { getMedusaAdminClient } from '@lib/data/medusa-client'
import { isPromotionActiveForStorefront } from '@lib/util/promotion-active'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

type PromotionRuleValue = { value?: string | null }
type PromotionRule = {
  attribute?: string | null
  operator?: string | null
  values?: PromotionRuleValue[] | null
}
type AdminPromotion = {
  id: string
  code: string
  type?: string | null
  status?: string | null
  is_automatic?: boolean | null
  campaign_id?: string | null
  campaign?: {
    id?: string | null
    name?: string | null
    campaign_identifier?: string | null
    status?: string | null
    is_active?: boolean | null
    starts_at?: string | null
    ends_at?: string | null
    deleted_at?: string | null
    budget?: {
      limit?: number | string | { value?: string | number | null } | null
      used?: number | string | { value?: string | number | null } | null
    } | null
  } | null
  rules?: PromotionRule[] | null
  application_method?: {
    type?: string | null
    target_type?: string | null
    allocation?: string | null
    value?: number | null
    currency_code?: string | null
    apply_to_quantity?: number | null
    buy_rules_min_quantity?: number | null
    max_quantity?: number | null
    target_rules?: PromotionRule[] | null
    buy_rules?: PromotionRule[] | null
  } | null
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')?.trim()

    if (!code) {
      return NextResponse.json(
        { success: false, message: 'code parameter is required' },
        { status: 400 },
      )
    }

    const admin = getMedusaAdminClient()

    const list = await admin.admin.promotion.list({
      code: [code],
      fields:
        'id,code,type,status,is_automatic,campaign_id,*campaign,*rules,*rules.values,*application_method,*application_method.target_rules,*application_method.target_rules.values,*application_method.buy_rules,*application_method.buy_rules.values',
      limit: 1,
    } as Parameters<typeof admin.admin.promotion.list>[0])

    const promotion =
      (list.promotions?.[0] as AdminPromotion | undefined) ?? null

    if (!promotion) {
      return NextResponse.json(
        { success: true, promotion: null },
        {
          headers: {
            'Cache-Control': 'no-store',
          },
        },
      )
    }

    const campaignId = promotion.campaign_id ?? promotion.campaign?.id
    if (campaignId) {
      try {
        const campaignResult = await admin.admin.campaign.retrieve(campaignId, {
          fields:
            'id,name,campaign_identifier,status,is_active,starts_at,ends_at,deleted_at,*budget',
        } as Parameters<typeof admin.admin.campaign.retrieve>[1])

        promotion.campaign = campaignResult.campaign as AdminPromotion['campaign']
      } catch (error) {
        console.warn('[api/store/promotions/by-code] campaign lookup failed:', {
          campaignId,
          message: error instanceof Error ? error.message : String(error),
        })
      }
    }

    if (!isPromotionActiveForStorefront(promotion)) {
      return NextResponse.json(
        { success: true, promotion: null },
        {
          headers: {
            'Cache-Control': 'no-store',
          },
        },
      )
    }

    return NextResponse.json(
      { success: true, promotion },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    )
  } catch (error: any) {
    const status =
      Number(error?.status || error?.response?.status) || 500
    const isUnauthorized =
      status === 401 ||
      String(error?.message || '').toLowerCase().includes('unauthorized')

    console.error('[api/store/promotions/by-code] error:', {
      status,
      message: error?.message,
    })

    return NextResponse.json(
      {
        success: false,
        message: isUnauthorized
          ? 'Medusa admin API key is unauthorized for promotions'
          : 'Failed to fetch promotion',
      },
      { status: isUnauthorized ? 401 : 500 },
    )
  }
}
