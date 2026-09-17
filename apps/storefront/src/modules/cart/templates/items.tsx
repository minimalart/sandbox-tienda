"use client";

import { useDisneyPromoState } from "@lib/hooks/use-disney-promo-state";
import type { HttpTypes } from "@medusajs/types";
import Item from "@modules/cart/components/item";
import { BundleCartGroup } from "@modules/bundles/components/bundle-cart-group";
import { buildCartPresentationFromItems } from "@modules/bundles/lib/cart-presentation";
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
  const disneySuppressedItemIds = useMemo(() => {
    const s = new Set<string>();
    if (disneyState.unlocked) return s;
    for (const it of items ?? []) {
      if (it.product_id && disneyTargetIdsSet.has(it.product_id)) s.add(it.id);
    }
    return s;
  }, [items, disneyState.unlocked, disneyTargetIdsSet]);

  // Sort BEFORE grouping so bundle groups anchor at the position of their
  // oldest item just like single line items do.
  const sortedItems = (items ?? [])
    .slice()
    .sort((a, b) => ((a.created_at ?? "") > (b.created_at ?? "") ? -1 : 1));
  const rows = useMemo(() => buildCartPresentationFromItems(sortedItems), [sortedItems]);

  return (
    <ul className="space-y-4" role="list">
      {rows.map((row) => {
        if (row.kind === "bundle") {
          return (
            <BundleCartGroup key={row.bundleInstanceId} bundle={row} cart={cart} />
          );
        }
        const item = row.item;
        return (
          <Item
            currencyCode={cart?.currency_code ?? "USD"}
            item={item}
            key={item.id}
            suppressDisneyPromo={disneySuppressedItemIds.has(item.id)}
            type="preview"
          />
        );
      })}
    </ul>
  );
};

export default ItemsTemplate;
