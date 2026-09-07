"use client";

import PaymentResultOverlay from "@modules/common/components/payment-result-overlay";

type OrderSuccessAnimationProps = {
  orderId: string;
  pendingPayment?: boolean;
};

/**
 * Order-confirmed overlay. Thin wrapper over the shared
 * <PaymentResultOverlay />: green (captured) or amber (pending) full-screen
 * screen with the success sound. The red/error variant lives on the
 * /checkout/failure page instead (a failed payment never reaches a
 * confirmed order).
 */
export default function OrderSuccessAnimation({
  pendingPayment = false,
}: OrderSuccessAnimationProps) {
  return (
    <PaymentResultOverlay variant={pendingPayment ? "pending" : "success"} />
  );
}
