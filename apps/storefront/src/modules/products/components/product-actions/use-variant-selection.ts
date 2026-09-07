'use client'

import {
  getIndividualVariant,
  isIndividualVariant,
} from '@lib/util/get-individual-variant'
import type { HttpTypes } from '@medusajs/types'
import { isEqual } from 'lodash'
import { useEffect, useMemo, useState } from 'react'

/** REGLA B2C: siempre la variante Individual, nunca la de Bulto. */
function findDefaultVariant(
  variants: HttpTypes.StoreProduct['variants'],
): HttpTypes.StoreProductVariant | undefined {
  return getIndividualVariant(variants)
}

/** Check if a variant is available for purchase */
export function checkVariantInStock(
  variant: HttpTypes.StoreProductVariant | undefined,
): boolean {
  if (!variant) {
    return false
  }
  if (variant.manage_inventory === false) {
    return true
  }
  if (variant.allow_backorder) {
    return true
  }
  if ((variant.inventory_quantity ?? 0) > 0) {
    return true
  }
  return false
}

const optionsAsKeymap = (
  variantOptions: HttpTypes.StoreProductVariant['options'],
): Record<string, string> | undefined =>
  variantOptions?.reduce<Record<string, string>>((acc, varopt) => {
    if (varopt.option_id && varopt.value) {
      acc[varopt.option_id] = varopt.value
    }
    return acc
  }, {})

/** Resolve the selected variant based on current options */
function resolveSelectedVariant(
  product: HttpTypes.StoreProduct,
  options: Record<string, string | undefined>,
): HttpTypes.StoreProductVariant | undefined {
  if (!product.variants || product.variants.length === 0) {
    return
  }

  if (product.variants.length === 1) {
    return product.variants[0]
  }

  const matchingVariant = product.variants.find((v) => {
    const variantOptions = optionsAsKeymap(v.options)
    return isEqual(variantOptions, options)
  })

  if (matchingVariant && !isIndividualVariant(matchingVariant)) {
    return findDefaultVariant(product.variants)
  }

  return matchingVariant ?? findDefaultVariant(product.variants)
}

export type ProductVariantSelection = {
  /** Currently picked option values, keyed by option id. */
  options: Record<string, string | undefined>
  /** Update a single option value. */
  setOptionValue: (optionId: string, value: string) => void
  /** The variant resolved from the current options (falls back to Individual). */
  selectedVariant: HttpTypes.StoreProductVariant | undefined
  /**
   * Product options that offer a real choice for the B2C shopper. Options with
   * ≤1 sellable value (e.g. "Formato: Único") and the wholesale "Bulto" variant
   * are dropped, so this is empty for single-variant products.
   */
  selectableOptions: { option: HttpTypes.StoreProductOption }[]
  /** Whether the selected variant can be purchased. */
  variantInStock: boolean
}

/**
 * Owns the variant/option selection for a product. Extracted from ProductActions
 * so the selection can be lifted to a parent (e.g. the quick-view modal renders
 * the size dropdown next to the price while ProductActions renders the button):
 * both share a single source of truth via {@link ProductVariantSelection}.
 */
export function useProductVariantSelection(
  product: HttpTypes.StoreProduct,
): ProductVariantSelection {
  const [options, setOptions] = useState<Record<string, string | undefined>>({})

  useEffect(() => {
    const defaultVariant = findDefaultVariant(product.variants)
    if (!defaultVariant) return
    const variantOptions = optionsAsKeymap(defaultVariant.options)
    if (variantOptions) {
      setOptions(variantOptions as Record<string, string | undefined>)
    }
  }, [product.variants])

  const selectedVariant = useMemo(
    () => resolveSelectedVariant(product, options),
    [product, options],
  )

  const variantInStock = useMemo(
    () => checkVariantInStock(selectedVariant),
    [selectedVariant],
  )

  // Variants the B2C storefront can actually sell (the wholesale "Bulto" variant
  // is never offered). A real size/option picker only makes sense when there's
  // more than one of these to choose from — single-variant products (grocery, or
  // a one-size item) keep the legacy "no selector" behavior.
  const selectableVariants = useMemo(
    () => (product.variants ?? []).filter((v) => isIndividualVariant(v)),
    [product.variants],
  )

  // Per product option, the values present on a sellable variant. Options that
  // don't offer a real choice (≤1 value, e.g. "Formato: Único") are dropped.
  const selectableOptions = useMemo(() => {
    if (selectableVariants.length <= 1) return []
    return (product.options ?? [])
      .map((option) => {
        const allowed = new Set(
          selectableVariants.flatMap((v) =>
            (v.options ?? [])
              .filter((o) => o.option_id === option.id)
              .map((o) => o.value)
              .filter((val): val is string => !!val),
          ),
        )
        return {
          option: {
            ...option,
            values: (option.values ?? []).filter((ov) => allowed.has(ov.value)),
          },
        }
      })
      .filter((entry) => entry.option.values.length > 1)
  }, [product.options, selectableVariants])

  const setOptionValue = (optionId: string, value: string) => {
    setOptions((prev) => ({ ...prev, [optionId]: value }))
  }

  return {
    options,
    setOptionValue,
    selectedVariant,
    selectableOptions,
    variantInStock,
  }
}
