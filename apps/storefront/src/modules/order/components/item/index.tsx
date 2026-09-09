import { presentationSummary } from "@lib/util/catalog-commercial";
import type { HttpTypes } from "@medusajs/types";
import { Text } from "@medusajs/ui";

import LineItemOptions from "@modules/common/components/line-item-options";
import LineItemPrice from "@modules/common/components/line-item-price";
import Thumbnail from "@modules/products/components/thumbnail";

type ItemProps = {
  item: HttpTypes.StoreCartLineItem | HttpTypes.StoreOrderLineItem;
  currencyCode: string;
};

const Item = ({ item, currencyCode }: ItemProps) => (
  <div
    className="mb-3 flex items-center gap-4 rounded-xl bg-[#F9FAFB] p-4 last:mb-0"
    data-testid="product-row"
  >
    <div className="h-20 w-20 shrink-0">
      <Thumbnail className="w-20 rounded-xl bg-ui-bg-base p-0 shadow-none" size="square" thumbnail={item.thumbnail} />
    </div>

    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <div className="min-w-0">
        <Text
          className="truncate text-base font-semibold text-ui-fg-base"
          data-testid="product-name"
        >
          {item.product_title}
        </Text>
        {presentationSummary(item.metadata, item.quantity) && <Text size="small">{presentationSummary(item.metadata, item.quantity)}</Text>}
        <LineItemOptions
          data-testid="product-variant"
          variant={item.variant}
          metadata={item.metadata}
        />
      </div>

      <div className="mt-1 flex items-end justify-between gap-2">
        <Text className="text-sm text-ui-fg-subtle">
          Cantidad: <span data-testid="product-quantity">{item.quantity}</span>
        </Text>
        <LineItemPrice currencyCode={currencyCode} item={item} style="tight" />
      </div>
    </div>
  </div>
);

export default Item;
