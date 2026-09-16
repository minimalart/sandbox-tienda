import { formatProductTitleCapitalized } from "@lib/util/format-product-title";
import { convertToLocale } from "@lib/util/money";
import type { HttpTypes } from "@medusajs/types";
import { Text } from "@medusajs/ui";

import Thumbnail from "@modules/products/components/thumbnail";
import TintColorLabel from "@modules/common/components/tint-color-label";
import TransportConditionBadge from "@modules/common/components/transport-condition-badge";

type ConfirmedItemRowProps = {
  item: HttpTypes.StoreCartLineItem | HttpTypes.StoreOrderLineItem;
  currencyCode: string;
};

const getVariantLabel = (
  item: HttpTypes.StoreCartLineItem | HttpTypes.StoreOrderLineItem,
) => {
  const variantValues =
    item.variant?.options
      ?.map((option) => option.value)
      .filter((value): value is string => Boolean(value)) ?? [];

  if (variantValues.length > 0) {
    return formatProductTitleCapitalized(variantValues.join(" / "));
  }

  return formatProductTitleCapitalized(item.variant_title ?? "");
};

const ConfirmedItemRow = ({ item, currencyCode }: ConfirmedItemRowProps) => {
  const variantLabel = getVariantLabel(item);
  const hasReducedPrice = (item.total ?? 0) < (item.original_total ?? 0);
  const originalPrice = convertToLocale({
    amount: item.original_total ?? 0,
    currency_code: currencyCode,
  });
  const currentPrice = convertToLocale({
    amount: item.total ?? 0,
    currency_code: currencyCode,
  });

  return (
    <div
      className="mb-3 flex items-center gap-4 rounded-xl bg-[#F9FAFB] p-4 last:mb-0"
      data-testid="product-row"
    >
      <div className="h-20 w-20 shrink-0">
        <Thumbnail
          className="w-20 rounded-xl bg-ui-bg-base p-0 shadow-none border border-[0.8px] border-[#F3F4F6]"
          size="square"
          thumbnail={item.thumbnail}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Text className="truncate text-[14px] font-[500] text-[#101828]" data-testid="product-name">
          {item.product_title}
        </Text>

        {variantLabel && (
          <Text className="truncate text-sm font-[400] text-[12px] text-[#6B7280]" data-testid="product-variant">
            {variantLabel}
          </Text>
        )}

        {/*
          El color entonado va ADEMÁS de la variante, no en su lugar: en una
          pintura la variante es el litraje ("4 Lt") y las dos cosas importan.
          Sin esto la orden confirmada mostraba el recargo de entonado cobrado
          sin decir nunca de qué color.
        */}
        <TintColorLabel
          className="max-w-full text-[12px] font-[400] text-[#6B7280]"
          metadata={item.metadata}
        />

        <TransportConditionBadge className="mt-1 self-start" item={item} size="sm" />

        <div className="mt-1 flex items-end justify-between gap-2">
          <Text className="text-sm text-ui-fg-subtle">
            Cantidad: <span data-testid="product-quantity">{item.quantity}</span>
          </Text>
          <div className="flex items-center justify-center gap-2 whitespace-nowrap">
            {hasReducedPrice && (
              <span
                className="text-[14px] font-medium text-ui-fg-muted line-through"
                data-testid="product-original-price"
              >
                $ {originalPrice}
              </span>
            )}
            <span
              className="text-[16px] font-medium leading-none text-[#101828]"
              data-testid="product-price"
            >
              $ {currentPrice}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmedItemRow;
