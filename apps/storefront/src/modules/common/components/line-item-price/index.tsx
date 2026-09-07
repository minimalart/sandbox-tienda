import { getPercentageDiff } from "@lib/util/get-precentage-diff";
import { convertToLocale } from "@lib/util/money";
import type { HttpTypes } from "@medusajs/types";
import { clx } from "@medusajs/ui";

type LineItemPriceProps = {
  item: HttpTypes.StoreCartLineItem | HttpTypes.StoreOrderLineItem;
  style?: "default" | "tight";
  currencyCode: string;
  suppressDiscount?: boolean;
};

const LineItemPrice = ({
  item,
  style = "default",
  currencyCode,
  suppressDiscount = false,
}: LineItemPriceProps) => {
  const { total, original_total } = item;
  const originalPrice = original_total ?? 0;
  const currentPrice = suppressDiscount ? originalPrice : total ?? 0;
  const hasReducedPrice = !suppressDiscount && currentPrice < originalPrice;

  return (
    <div className="flex flex-col items-end gap-x-2 text-ui-fg-subtle">
      <div className="text-left">
        {hasReducedPrice && (
          <>
            <p className="flex items-center justify-end">
              {style === "default" && (
                <span className="text-ui-fg-subtle">Original: </span>
              )}
              <span
                className="text-ui-fg-muted line-through font-[500] text-[14px]"
                data-testid="product-original-price"
              >
                ${" "}
                {convertToLocale({
                  amount: originalPrice,
                  currency_code: currencyCode,
                })}
              </span>
            </p>
            {style === "default" && (
              <span className="text-[--primary-color]">
                -{getPercentageDiff(originalPrice, currentPrice || 0)}%
              </span>
            )}
          </>
        )}
        <span
          className={clx("text-[#101828] font-[500] text-[16px]", {
            "text-[#101828] font-[500] text-[16px]": hasReducedPrice,
          })}
          data-testid="product-price"
        >
          ${" "}
          {convertToLocale({
            amount: currentPrice,
            currency_code: currencyCode,
          })}
        </span>
      </div>
    </div>
  );
};

export default LineItemPrice;
