'use client'

import { useEffect, useState } from 'react'

export type PromotionRuleValue = { value?: string | null }
export type PromotionRule = {
  attribute?: string | null
  operator?: string | null
  values?: PromotionRuleValue[] | null
}
export type AdminPromotion = {
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

const cache = new Map<
  string,
  { promise?: Promise<AdminPromotion | null>; promotion?: AdminPromotion | null }
>()

async function fetchPromotion(code: string): Promise<AdminPromotion | null> {
  const res = await fetch(
    `/api/store/promotions/by-code?code=${encodeURIComponent(code)}`,
    { cache: 'no-store' },
  )
  if (!res.ok) return null
  const data = (await res.json()) as {
    success?: boolean
    promotion?: AdminPromotion | null
  }
  return data?.promotion ?? null
}

function getPromotionPromise(code: string): Promise<AdminPromotion | null> {
  const cached = cache.get(code)
  if (cached?.promise) {
    return cached.promise
  }

  const promise = fetchPromotion(code)
    .then((result) => {
      cache.set(code, { promotion: result, promise })
      return result
    })
    .finally(() => {
      const entry = cache.get(code)
      if (entry) {
        delete entry.promise
        cache.set(code, entry)
      }
    })

  cache.set(code, { ...cached, promise })
  return promise
}

export function usePromotionByCode(code: string | null | undefined): {
  promotion: AdminPromotion | null
  isLoading: boolean
} {
  const [promotion, setPromotion] = useState<AdminPromotion | null>(() => {
    if (!code) return null
    return cache.get(code)?.promotion ?? null
  })
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    if (!code) return false
    return !cache.get(code)?.promotion
  })

  useEffect(() => {
    if (!code) {
      setPromotion(null)
      setIsLoading(false)
      return
    }

    let cancelled = false
    const cached = cache.get(code)

    if (cached?.promotion !== undefined) {
      setPromotion(cached.promotion ?? null)
      setIsLoading(false)
    } else {
      setIsLoading(true)
    }

    const promise = getPromotionPromise(code)

    promise
      .then((result) => {
        if (cancelled) return
        setPromotion(result)
        setIsLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        if (cached?.promotion === undefined) {
          setPromotion(null)
        }
        setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [code])

  return { promotion, isLoading }
}
