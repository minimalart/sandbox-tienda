"use client";

import { useEffect, useState } from "react";
import { useTypesenseProducts } from "./use-typesense-products";
import type { HttpTypes } from "@medusajs/types";

type CartItemPromotions = Record<
  string,
  {
    productId: string;
    promotions: Array<{
      id: string;
      code: string;
      type: string;
      status?: string;
      campaign?: {
        id: string;
        name: string;
      };
      application_method?: {
        type?: string;
        value?: number;
        apply_to_quantity?: number;
        buy_rules_min_quantity?: number;
        max_quantity?: number;
        target_rules?: Array<{
          attribute?: string;
          values?: Array<{ value?: string }>;
        }>;
        buy_rules?: Array<{
          attribute?: string;
          values?: Array<{ value?: string }>;
        }>;
      };
    }>;
  }
>;

export function useCartPromotions(
  cart: HttpTypes.StoreCart | null,
): {
  promotions: CartItemPromotions;
  isLoading: boolean;
} {
  const [promotions, setPromotions] = useState<CartItemPromotions>({});
  const [isLoading, setIsLoading] = useState(false);

  // Extract unique product IDs from cart items
  const productIds = cart?.items
    ?.map((item) => item.product_id)
    .filter((id): id is string => Boolean(id));

  // Use Typesense to fetch products with promotions
  const { products: typesenseProducts, isLoading: typesenseLoading } =
    useTypesenseProducts({
      productIds: productIds?.length ? productIds : undefined,
      limit: productIds?.length || 0,
    });

  useEffect(() => {
    if (!cart?.items?.length) {
      setPromotions({});
      return;
    }

    setIsLoading(true);

    // Map product IDs to their promotions from Typesense
    const promotionsMap: CartItemPromotions = {};

    typesenseProducts.forEach((product) => {
      if (product.promotions && product.promotions.length > 0) {
        promotionsMap[product.id] = {
          productId: product.id,
          promotions: product.promotions,
        };
      }
    });

    setPromotions(promotionsMap);
    setIsLoading(false);
  }, [cart?.items, typesenseProducts]);

  return {
    promotions,
    isLoading: isLoading || typesenseLoading,
  };
}
