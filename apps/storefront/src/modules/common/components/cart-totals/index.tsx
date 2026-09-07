"use client";

import { GiftIcon, TrashIcon } from "@heroicons/react/24/outline";
import { convertToLocale } from "@lib/util/money";
import type React from "react";
import { useState } from "react";

type AppliedPromotion = {
  id?: string;
  code?: string | null;
  is_automatic?: boolean | null;
};

type CartCreditLine = {
  amount?: number | null;
  reference?: string | null;
};

type CartTotalsProps = {
  totals: {
    total?: number | null;
    subtotal?: number | null;
    tax_total?: number | null;
    shipping_total?: number | null;
    discount_total?: number | null;
    gift_card_total?: number | null;
    currency_code: string;
    shipping_subtotal?: number | null;
    credit_lines?: CartCreditLine[] | null;
  };
  promotions?: AppliedPromotion[];
  onRemovePromotion?: (code: string) => Promise<void> | void;
  showTotal?: boolean;
};

const CartTotals: React.FC<CartTotalsProps> = ({
  totals,
  promotions = [],
  onRemovePromotion,
  showTotal = true,
}) => {
  const {
    currency_code,
    total,
    discount_total,
    gift_card_total,
    shipping_total,
    shipping_subtotal,
    credit_lines,
  } = totals;

  // El loyalty-plugin aplica las gift cards como `credit_lines`
  // (reference === "gift-card"), no con el campo legacy `gift_card_total`.
  // Sumamos esas líneas para mostrar el descuento en el desglose.
  const giftCardFromCreditLines = (credit_lines ?? [])
    .filter((line) => line?.reference === "gift-card")
    .reduce((acc, line) => acc + Math.max(0, line?.amount ?? 0), 0);

  const giftCardDiscount = gift_card_total || giftCardFromCreditLines;

  // Mostramos todo el desglose con impuestos incluidos (igual que el Total),
  // sin diferenciar el IVA: los campos `subtotal`/`shipping_subtotal` de Medusa
  // vienen sin impuestos, mientras que `total` ya los incluye. Usamos
  // `shipping_total` (con impuestos) para el envío y derivamos el subtotal de
  // productos como el residuo que reconcilia exactamente con el Total:
  //   Subtotal + Envío − Descuento − Tarjeta de regalo = Total
  const shippingInclusive = shipping_total ?? shipping_subtotal ?? 0;
  const productsSubtotal =
    (total ?? 0) - shippingInclusive + (discount_total ?? 0) + giftCardDiscount;

  const manualPromotions = promotions.filter(
    (promo) => promo?.code && !promo?.is_automatic,
  );

  const [removingCode, setRemovingCode] = useState<string | null>(null);

  const formatPrice = (amount: number) =>
    convertToLocale({
      amount,
      currency_code,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      locale: "es-AR",
    });

  const shippingIsFree = shippingInclusive === 0;

  return (
    <div>
      <dl className="mt-4 space-y-4">
      <div className="flex items-center justify-between">
        <dt className="text-[--label-color] text-sm">Subtotal</dt>
        <dd
          className="font-medium text-[--text-dark] text-sm"
          data-testid="cart-subtotal"
          data-value={productsSubtotal}
        >
          {"$ " + formatPrice(productsSubtotal)}
        </dd>
      </div>
      {!!discount_total && (
        <div className="flex items-center justify-between">
          <dt className="font-medium text-[--primary-color] text-sm">
            Descuento promocional:
          </dt>
          <dd
            className="font-semibold text-[--primary-color] text-sm"
            data-testid="cart-discount"
            data-value={discount_total || 0}
          >
            -{"$ " + formatPrice(discount_total ?? 0)}
          </dd>
        </div>
      )}
      {manualPromotions.length > 0 && (
        <div className="space-y-1.5 border-gray-100 border-t pt-3">
          <dt className="text-gray-500 text-xs font-medium">
            Cupones aplicados
          </dt>
          <ul className="flex flex-col gap-1.5">
            {manualPromotions.map((promo) => (
              <li
                className="flex items-center justify-between gap-2"
                data-testid="cart-totals-promo-row"
                key={promo.id ?? promo.code}
              >
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-emerald-700 text-xs font-medium">
                  <GiftIcon className="h-3.5 w-3.5" />
                  {promo.code}
                </span>
                {onRemovePromotion && (
                  <button
                    aria-label={`Quitar cupón ${promo.code}`}
                    className="flex items-center text-gray-400 hover:text-red-600 disabled:opacity-50"
                    data-testid="cart-totals-promo-remove"
                    disabled={removingCode === promo.code}
                    onClick={async () => {
                      if (!promo.code) return;
                      setRemovingCode(promo.code);
                      try {
                        await onRemovePromotion(promo.code);
                      } finally {
                        setRemovingCode(null);
                      }
                    }}
                    type="button"
                  >
                    {removingCode === promo.code ? (
                      <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" />
                    ) : (
                      <TrashIcon className="h-4 w-4" />
                    )}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex items-center justify-between">
        <dt className="text-[--label-color] text-sm">Envío</dt>
        <dd
          className={`font-medium text-sm ${
            shippingIsFree ? "text-[--success-color]" : "text-[--text-dark]"
          }`}
          data-testid="cart-shipping"
          data-value={shippingInclusive}
        >
          {shippingIsFree ? "Gratis" : "$ " + formatPrice(shippingInclusive)}
        </dd>
      </div>
      {!!giftCardDiscount && (
        <div className="flex items-center justify-between">
          <dt className="text-[--label-color] text-sm">Tarjeta de regalo</dt>
          <dd
            className="font-medium text-[--text-dark] text-sm"
            data-testid="cart-gift-card-amount"
            data-value={giftCardDiscount || 0}
          >
            -{"$ " + formatPrice(giftCardDiscount)}
          </dd>
        </div>
      )}
      {showTotal && (
        <div className="flex items-center justify-between border-gray-200 border-t pt-4">
          <dt className="font-bold text-2xl text-[--text-dark]">Total</dt>
          <dd
            className="font-bold text-2xl text-[--text-dark]"
            data-testid="cart-total"
            data-value={total || 0}
          >
            {"$ " + formatPrice(total ?? 0)}
          </dd>
        </div>
      )}
      </dl>
      {showTotal && (
        <p className="mt-2 text-[--icon-muted] text-xs">Impuestos incluidos</p>
      )}
    </div>
  );
};

export default CartTotals;
