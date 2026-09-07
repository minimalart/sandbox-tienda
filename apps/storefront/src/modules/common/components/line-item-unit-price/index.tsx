import { convertToLocale } from "@lib/util/money";
import type { HttpTypes } from "@medusajs/types";
import { clx } from "@medusajs/ui";

type LineItemUnitPriceProps = {
  item: HttpTypes.StoreCartLineItem | HttpTypes.StoreOrderLineItem;
  style?: "default" | "tight";
  currencyCode: string;
  suppressDiscount?: boolean;
};

const LineItemUnitPrice = ({
  item,
  style = "default",
  currencyCode,
  suppressDiscount = false,
}: LineItemUnitPriceProps) => {
  const { total, original_total } = item;
  const safeOriginalTotal = original_total ?? 0;
  const safeTotal = total ?? 0;
  const effectiveTotal = suppressDiscount ? safeOriginalTotal : safeTotal;
  const hasReducedPrice = !suppressDiscount && safeTotal < safeOriginalTotal;

  const percentage_diff =
    safeOriginalTotal > 0
      ? Math.round(((safeOriginalTotal - safeTotal) / safeOriginalTotal) * 100)
      : 0;

  return (
    <div className="flex h-full flex-col justify-center text-ui-fg-muted">
      {hasReducedPrice && (
        <>
          <div>
            {style === "default" && (
              <span className="text-ui-fg-muted">Original: </span>
            )}
            <span
              className="line-through"
              data-testid="product-unit-original-price"
            >
              {convertToLocale({
                amount: safeOriginalTotal / item.quantity,
                currency_code: currencyCode,
              })}
            </span>
          </div>
          {style === "default" && (
            <span className="text-[--primary-color]">-{percentage_diff}%</span>
          )}
        </>
      )}
      <span
        className={clx("text-base-regular", {
          "text-[--primary-color]": hasReducedPrice,
        })}
        data-testid="product-unit-price"
      >
        {"$ " + convertToLocale({
          amount: effectiveTotal / item.quantity,
          currency_code: currencyCode,
        })}
      </span>
    </div>
  );
};

export default LineItemUnitPrice;
