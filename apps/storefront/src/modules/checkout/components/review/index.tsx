"use client";

import { clx, Heading, Text } from "@medusajs/ui";
import { useSearchParams } from "next/navigation";
import PaymentButton from "../payment-button";

const Review = ({ cart }: { cart: any }) => {
  const searchParams = useSearchParams();

  const isOpen = searchParams.get("step") === "review";

  const paidByGiftcard =
    cart?.gift_cards && cart?.gift_cards?.length > 0 && cart?.total === 0;

  const previousStepsCompleted =
    cart.shipping_address &&
    cart.shipping_methods.length > 0 &&
    (cart.payment_collection || paidByGiftcard);

  return (
    <div>
      <div className="mb-4 flex flex-row items-center justify-between">
        <h2 className="font-medium text-gray-900 text-lg">
          Revisión
        </h2>
      </div>
      {isOpen && previousStepsCompleted && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 sm:p-6">
          <div className="mb-6 flex w-full items-start gap-x-1">
            <div className="w-full">
              <Text className="txt-medium-plus mb-1 text-ui-fg-base">
                Al hacer clic en "Confirmar pedido" aceptás nuestros Términos de
                uso, Términos de venta y Políticas de cambios, y confirmás que
                leíste la Política de privacidad.
              </Text>
            </div>
          </div>
          <PaymentButton cart={cart} data-testid="submit-order-button" />
        </div>
      )}
    </div>
  );
};

export default Review;
