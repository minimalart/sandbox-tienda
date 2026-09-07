"use client";

import { useTenant } from "@lib/site-config/context";
import type { TypesenseProductDocument } from "@lib/typesense";
import { getSubscriptionPlans } from "@lib/data/recurring-orders";
import TypesenseProductCard from "./typesense-product-card";
import { useEffect, useMemo, useState } from "react";

type TypesenseProductGridProps = {
  products: TypesenseProductDocument[];
  countryCode: string;
};

export default function TypesenseProductGrid({
  products,
  countryCode,
}: TypesenseProductGridProps) {
  const tenant = useTenant();
  const isSportsTemplate = tenant.template === "sports";
  const productIdsKey = useMemo(
    () => products.map((product) => product.id).filter(Boolean).sort().join(','),
    [products],
  );
  const [subscriptionBenefits, setSubscriptionBenefits] = useState<
    Record<string, { planName: string; discountPercentage: number }>
  >({});

  // Un único lookup por lote evita un request por card y mantiene el catálogo
  // alineado con los planes publicados del canal activo.
  useEffect(() => {
    let active = true;
    if (!productIdsKey) return;
    void getSubscriptionPlans({ productIds: productIdsKey.split(',') }).then(({ plans }) => {
      if (!active) return;
      const next: Record<string, { planName: string; discountPercentage: number }> = {};
      for (const plan of plans) {
        const discountPercentage = Math.max(
          0,
          ...plan.offers
            .filter((offer) => offer.discount_type === 'percentage')
            .map((offer) => offer.discount_value),
        );
        for (const productId of plan.eligible_product_ids) {
          if (!next[productId] || next[productId].discountPercentage < discountPercentage) {
            next[productId] = { planName: plan.name, discountPercentage };
          }
        }
      }
      setSubscriptionBenefits(next);
    });
    return () => { active = false; };
  }, [productIdsKey]);

  // Note: stock-based ordering is applied per-batch inside useTypesenseProducts
  // so that items already rendered never shift position when new pages load.
  return (
    <div
      className={
        isSportsTemplate
          ? "mx-auto max-w-none px-0"
          : "mx-auto max-w-7xl px-0 sm:px-0 lg:px-0"
      }
    >
      <ul
        data-sports-grid={isSportsTemplate ? "true" : undefined}
        className={
          isSportsTemplate
            ? "grid grid-cols-2 items-stretch border-[--sp-hairline] border-l border-t bg-white sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4"
            : "grid grid-cols-2 justify-items-center items-stretch gap-x-2 gap-y-2 pr-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 xl:gap-x-[8px]"
        }
      >
        {products.map((product) => (
          <li
            key={product.id}
            data-sports-grid-cell={isSportsTemplate ? "true" : undefined}
            className={
              isSportsTemplate
                ? "flex w-full border-[--sp-hairline] border-b border-r p-3 sm:p-4 lg:p-5"
                : "flex w-full max-w-[216px]"
            }
          >
            <TypesenseProductCard
              countryCode={countryCode}
              product={product}
              subscriptionBenefit={subscriptionBenefits[product.id]}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
