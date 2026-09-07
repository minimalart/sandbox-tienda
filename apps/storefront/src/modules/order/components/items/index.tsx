"use client";

import repeat from "@lib/util/repeat";
import type { HttpTypes } from "@medusajs/types";
import { useMemo, useState } from "react";

import ConfirmedItemRow from "@modules/order/components/confirmed-item-row";
import SkeletonLineItem from "@modules/skeletons/components/skeleton-line-item";

type ItemsProps = {
  order: HttpTypes.StoreOrder;
};

const Items = ({ order }: ItemsProps) => {
  const [showAllMobile, setShowAllMobile] = useState(false);
  const items = order.items ?? [];
  const sortedItems = useMemo(
    () =>
      [...items].sort((a, b) => ((a.created_at ?? "") > (b.created_at ?? "") ? -1 : 1)),
    [items],
  );
  const mobileItems = showAllMobile ? sortedItems : sortedItems.slice(0, 4);
  const shouldShowMobileToggle = sortedItems.length > 4 && !showAllMobile;

  return (
    <>
      <div className="md:hidden" data-testid="products-table-mobile">
        {sortedItems.length
          ? mobileItems.map((item) => (
              <ConfirmedItemRow
                currencyCode={order.currency_code}
                item={item}
                key={item.id}
              />
            ))
          : repeat(5).map((i) => <SkeletonLineItem key={i} />)}

        {shouldShowMobileToggle && (
          <button
            className="mt-3 w-full px-4 py-2 text-sm font-medium text-[--primary-color]"
            onClick={() => setShowAllMobile(true)}
            type="button"
          >
            Ver más productos
          </button>
        )}
      </div>

      <div
        className="hidden max-h-[446px] overflow-y-auto pr-2 md:block"
        data-testid="products-table"
      >
        {sortedItems.length
          ? sortedItems.map((item) => (
              <ConfirmedItemRow
                currencyCode={order.currency_code}
                item={item}
                key={item.id}
              />
            ))
          : repeat(5).map((i) => <SkeletonLineItem key={i} />)}
      </div>
    </>
  );
};

export default Items;
