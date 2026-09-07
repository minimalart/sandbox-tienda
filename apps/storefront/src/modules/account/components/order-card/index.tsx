import { formatDateAR } from "@lib/util/format-date";
import { convertToLocale } from "@lib/util/money";
import type { HttpTypes } from "@medusajs/types";
import { Button } from "@medusajs/ui";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import Thumbnail from "@modules/products/components/thumbnail";
import TransportConditionBadge from "@modules/common/components/transport-condition-badge";
import { resolveOrderTemperature } from "@lib/util/transport-condition";
import { useMemo } from "react";

type OrderCardProps = {
  order: HttpTypes.StoreOrder;
};

const OrderCard = ({ order }: OrderCardProps) => {
  const numberOfLines = useMemo(
    () => order.items?.reduce((acc, item) => acc + item.quantity, 0) ?? 0,
    [order],
  );

  const numberOfProducts = useMemo(() => order.items?.length ?? 0, [order]);

  const coldMode = useMemo(
    () => resolveOrderTemperature(order.items ?? []),
    [order],
  );

  const formattedDate = formatDateAR(order.created_at, {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <div
      className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
      data-testid="order-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold text-gray-500 text-sm">Pedido</p>
          <p className="font-semibold text-gray-900 text-lg">
            #<span data-testid="order-display-id">{order.custom_display_id ?? order.display_id}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-gray-500 text-sm">Total</p>
          <p
            className="font-semibold text-base text-gray-900"
            data-testid="order-amount"
          >
            ${" "}
            {convertToLocale({
              amount: order.total ?? 0,
              currency_code: order.currency_code ?? "ars",
            })}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-6 text-gray-600 text-sm">
        <span
          className="flex items-center gap-2"
          data-testid="order-created-at"
        >
          <span className="text-gray-500">Fecha:</span> {formattedDate}
        </span>
        <span>
          <span className="text-gray-500">Artículos:</span> {numberOfLines}
        </span>
        {coldMode !== "ambient" && (
          <TransportConditionBadge mode={coldMode} size="sm" />
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 small:grid-cols-5">
        {order.items?.slice(0, 3).map((i) => (
          <div
            className="flex flex-col gap-y-2"
            data-testid="order-item"
            key={i.id}
          >
            <Thumbnail images={[]} size="small" thumbnail={i.thumbnail} />
            <div className="flex items-center text-gray-700 text-sm">
              <span className="font-medium" data-testid="item-title">
                {i.title}
              </span>
              <span className="ml-2 text-gray-500">x</span>
              <span data-testid="item-quantity">{i.quantity}</span>
            </div>
          </div>
        ))}
        {numberOfProducts > 4 && (
          <div className="flex h-full w-full flex-col items-center justify-center rounded-lg border border-gray-200 border-dashed text-gray-500 text-sm">
            <span>+ {numberOfLines - 4}</span>
            <span>artículos más</span>
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <LocalizedClientLink href={`/account/orders/details/${order.id}`}>
          <Button
            className="px-4 py-2 font-semibold text-sm"
            data-testid="order-details-link"
          >
            Ver detalle
          </Button>
        </LocalizedClientLink>
      </div>
    </div>
  );
};

export default OrderCard;
