"use client";

import { convertToLocale } from "@lib/util/money";
import type React from "react";

type OrderSummaryTotalsProps = {
  totals: {
    total?: number | null;
    subtotal?: number | null;
    shipping_total?: number | null;
    shipping_subtotal?: number | null;
    currency_code: string;
  };
};

const OrderSummaryTotals: React.FC<OrderSummaryTotalsProps> = ({ totals }) => {
  const { currency_code, total, shipping_total, shipping_subtotal } = totals;

  // Mostramos el desglose con impuestos incluidos (igual que el Total), sin
  // diferenciar el IVA: `shipping_subtotal` viene sin impuestos y `total` ya
  // los incluye. Usamos `shipping_total` (con impuestos) para el envío y el
  // subtotal de productos es el residuo que reconcilia con el Total:
  //   Subtotal + Envío = Total
  const shippingInclusive = shipping_total ?? shipping_subtotal ?? 0;
  const productsSubtotal = (total ?? 0) - shippingInclusive;

  const formatPrice = (amount: number) =>
    convertToLocale({
      amount,
      currency_code,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      locale: "es-AR",
    });

  const shippingIsFree = shippingInclusive <= 0;

  return (
    <dl className="mt-5 border-t border-[#E5E7EB] pt-5">
      <div className="flex items-center justify-between">
        <dt className="text-sm text-ui-fg-subtle">Subtotal</dt>
        <dd className="text-sm font-medium text-ui-fg-base" data-testid="order-subtotal">
          {"$ " + formatPrice(productsSubtotal)}
        </dd>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <dt className="text-sm text-ui-fg-subtle">Envío</dt>
        <dd
          className={` ${shippingIsFree ? "text-green-600 text-[13px] font-[400]" : "text-ui-fg-base text-sm font-medium"}`}
          data-testid="order-shipping"
        >
          {shippingIsFree ? "Gratis" : "$ " + formatPrice(shippingInclusive)}
        </dd>
      </div>

      <div className="mt-4 flex items-center justify-between pt-4">
        <dt className="text-[20px] font-semibold leading-9 text-[--text-dark]">
          Total pagado
        </dt>
        <dd className="text-[20px] font-bold leading-9 text-[--text-dark]" data-testid="order-total">
          {"$ " + formatPrice(total ?? 0)}
        </dd>
      </div>
      <p className="mt-1 text-[--icon-muted] text-xs">Impuestos incluidos</p>
    </dl>
  );
};

export default OrderSummaryTotals;
