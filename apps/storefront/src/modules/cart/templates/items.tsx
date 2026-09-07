"use client";

import { useDisneyPromoState } from "@lib/hooks/use-disney-promo-state";
import type { HttpTypes } from "@medusajs/types";
import Item from "@modules/cart/components/item";
import { useMemo } from "react";

type ItemsTemplateProps = {
  cart?: HttpTypes.StoreCart;
};

const ItemsTemplate = ({ cart }: ItemsTemplateProps) => {
  const items = cart?.items;
  // Disney promo removed — stub yields null promotion
  const disneyState = useDisneyPromoState(null, items ?? []);
  const disneyTargetIdsSet = useMemo(
    () => new Set(disneyState.targetProductIds),
    [disneyState.targetProductIds],
  );

  return (
    <ul className="space-y-4" role="list">
      {items
        ?.sort((a, b) => ((a.created_at ?? "") > (b.created_at ?? "") ? -1 : 1))
        .map((item) => (
          <Item
            currencyCode={cart?.currency_code ?? "USD"}
            item={item}
            key={item.id}
            suppressDisneyPromo={
              Boolean(item.product_id) &&
              !disneyState.unlocked &&
              disneyTargetIdsSet.has(item.product_id as string)
            }
            type="preview"
          />
        ))}
    </ul>
  );
};

export default ItemsTemplate;
