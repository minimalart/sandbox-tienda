"use client";

import { useDisneyPromoState } from "@lib/hooks/use-disney-promo-state";
import repeat from "@lib/util/repeat";
import type { HttpTypes } from "@medusajs/types";
import { clx } from "@medusajs/ui";
import { useMemo } from "react";

import Item from "@modules/cart/components/item";
import SkeletonLineItem from "@modules/skeletons/components/skeleton-line-item";

type ItemsTemplateProps = {
  cart: HttpTypes.StoreCart;
};

const ItemsPreviewTemplate = ({ cart }: ItemsTemplateProps) => {
  const items = cart.items;
  const hasOverflow = items && items.length > 4;
  // Disney promo removed — stub yields null promotion
  const disneyState = useDisneyPromoState(null, items ?? []);
  const disneyTargetIdsSet = useMemo(
    () => new Set(disneyState.targetProductIds),
    [disneyState.targetProductIds],
  );

  return (
    <ul
      className={clx("space-y-4", {
        "no-scrollbar max-h-[420px] overflow-x-hidden overflow-y-scroll":
          hasOverflow,
      })}
      role="list"
    >
      {items
        ? items
            .sort((a, b) =>
              (a.created_at ?? "") > (b.created_at ?? "") ? -1 : 1
            )
            .map((item) => (
              <Item
                currencyCode={cart.currency_code}
                item={item}
                key={item.id}
                suppressDisneyPromo={
                  Boolean(item.product_id) &&
                  !disneyState.unlocked &&
                  disneyTargetIdsSet.has(item.product_id as string)
                }
                type="preview"
              />
            ))
        : repeat(5).map((i) => <SkeletonLineItem key={i} />)}
    </ul>
  );
};

export default ItemsPreviewTemplate;
