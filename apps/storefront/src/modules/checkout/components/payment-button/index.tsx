"use client";

import { isCuentaCorriente, isManual, isStripe, isMercadoPago } from "@lib/constants";
import { useCartStore } from "@lib/stores";
import { triggerHaptic } from "@lib/util/haptics";
import type { HttpTypes } from "@medusajs/types";
import { Button } from "@medusajs/ui";
import { useElements, useStripe } from "@stripe/react-stripe-js";
import { useRouter } from "next/navigation";
import type React from "react";
import { useRef, useState } from "react";
import ErrorMessage from "../error-message";

type PaymentButtonProps = {
  cart: HttpTypes.StoreCart;
  "data-testid": string;
  availableShippingMethods?: any[] | null;
};

const PaymentButton: React.FC<PaymentButtonProps> = ({
  cart,
  "data-testid": dataTestId,
  availableShippingMethods,
}) => {
  // Si no hay métodos de envío disponibles, no requerimos que haya uno seleccionado
  const hasAvailableShippingMethods = (availableShippingMethods?.length ?? 0) > 0;
  const baseNotReady =
    !(cart && cart.shipping_address && cart.billing_address && cart.email) ||
    (hasAvailableShippingMethods && (cart.shipping_methods?.length ?? 0) < 1);
  const validationMessage: string | null = null;
  const notReady = baseNotReady;

  const paymentSession = cart.payment_collection?.payment_sessions?.[0];

  switch (true) {
    case isStripe(paymentSession?.provider_id):
      return (
        <StripePaymentButton
          cart={cart}
          data-testid={dataTestId}
          notReady={notReady}
          validationMessage={validationMessage}
        />
      );
    case isMercadoPago(paymentSession?.provider_id):
      return (
        <MercadoPagoPaymentButton
          cart={cart}
          data-testid={dataTestId}
          notReady={notReady}
          validationMessage={validationMessage}
        />
      );
    case isManual(paymentSession?.provider_id):
    case isCuentaCorriente(paymentSession?.provider_id):
      // Cuenta Corriente no procesa cobro: coloca la orden directamente (igual
      // que el pago manual). El movimiento de compra lo crea el backend.
      return (
        <ManualTestPaymentButton
          data-testid={dataTestId}
          notReady={notReady}
          validationMessage={validationMessage}
        />
      );
    default:
      return <Button disabled>{validationMessage || "Seleccioná un método de pago"}</Button>;
  }
};

const StripePaymentButton = ({
  cart,
  notReady,
  "data-testid": dataTestId,
  validationMessage,
}: {
  cart: HttpTypes.StoreCart;
  notReady: boolean;
  "data-testid"?: string;
  validationMessage: string | null;
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const router = useRouter();
  const clearCart = useCartStore((state) => state.clearCart);
  const placeOrderOnceRef = useRef(false);

  const onPaymentCompleted = async () => {
    if (placeOrderOnceRef.current) {
      return;
    }
    placeOrderOnceRef.current = true;
    try {
      const response = await fetch("/api/store/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "placeOrder" }),
      });
      
      const result = await response.json();
      
      if (result.success && result.type === "order" && result.redirectUrl) {
        // Limpiar el store de Zustand antes de redirigir
        clearCart();
        router.push(result.redirectUrl);
      } else {
        setErrorMessage(result.message || "Error al completar la orden");
        placeOrderOnceRef.current = false;
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Error al completar la orden");
      placeOrderOnceRef.current = false;
    } finally {
      setSubmitting(false);
    }
  };

  const stripe = useStripe();
  const elements = useElements();
  const card = elements?.getElement("card");

  const session = cart.payment_collection?.payment_sessions?.find(
    (s) => s.status === "pending"
  );

  const disabled = stripe && elements ? false : true;

  const handlePayment = async () => {
    triggerHaptic("success");
    setSubmitting(true);

    if (!(stripe && elements && card && cart)) {
      setSubmitting(false);
      return;
    }

    await stripe
      .confirmCardPayment(session?.data.client_secret as string, {
        payment_method: {
          card,
          billing_details: {
            name:
              cart.billing_address?.first_name +
              " " +
              cart.billing_address?.last_name,
            address: {
              city: cart.billing_address?.city ?? undefined,
              country: cart.billing_address?.country_code ?? undefined,
              line1: cart.billing_address?.address_1 ?? undefined,
              line2: cart.billing_address?.address_2 ?? undefined,
              postal_code: cart.billing_address?.postal_code ?? undefined,
              state: cart.billing_address?.province ?? undefined,
            },
            email: cart.email,
            phone: cart.billing_address?.phone ?? undefined,
          },
        },
      })
      .then(({ error, paymentIntent }) => {
        if (error) {
          const pi = error.payment_intent;

          if (
            (pi && pi.status === "requires_capture") ||
            (pi && pi.status === "succeeded")
          ) {
            onPaymentCompleted();
          }

          setErrorMessage(error.message || null);
          return;
        }

        if (
          (paymentIntent && paymentIntent.status === "requires_capture") ||
          paymentIntent.status === "succeeded"
        ) {
          return onPaymentCompleted();
        }

        return;
      });
  };

  return (
    <>
      <Button
        data-testid={dataTestId}
        disabled={disabled || notReady}
        isLoading={submitting}
        onClick={handlePayment}
        size="large"
      >
        Pagar
      </Button>
      <ErrorMessage
        data-testid="stripe-payment-error-message"
        error={validationMessage || errorMessage}
      />
    </>
  );
};

const MercadoPagoPaymentButton = ({
  cart,
  notReady,
  "data-testid": dataTestId,
  validationMessage,
}: {
  cart: HttpTypes.StoreCart;
  notReady: boolean;
  "data-testid"?: string;
  validationMessage: string | null;
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const paymentSession = cart.payment_collection?.payment_sessions?.find(
    (s) => s.status === "pending"
  );

  const handlePayment = () => {
    triggerHaptic("success");
    const initPoint = paymentSession?.data?.init_point;

    if (!initPoint) {
      setErrorMessage("No se pudo obtener la URL de pago de MercadoPago");
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    // Redirect to MercadoPago. The order is placed on return
    // (/checkout/success|pending) via the placeOrder action.
    window.location.href = initPoint as string;
  };

  return (
    <>
      <Button
        data-testid={dataTestId}
        disabled={notReady || submitting}
        isLoading={submitting}
        onClick={handlePayment}
        size="large"
      >
        {submitting ? "Procesando..." : "Ir a pagar"}
      </Button>
      <ErrorMessage
        data-testid="mercadopago-payment-error-message"
        error={validationMessage || errorMessage}
      />
    </>
  );
};

const ManualTestPaymentButton = ({
  notReady,
  validationMessage,
}: {
  notReady: boolean;
  validationMessage: string | null;
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const router = useRouter();
  const clearCart = useCartStore((state) => state.clearCart);
  const placeOrderOnceRef = useRef(false);

  const onPaymentCompleted = async () => {
    if (placeOrderOnceRef.current) {
      return;
    }
    placeOrderOnceRef.current = true;
    try {
      const response = await fetch("/api/store/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "placeOrder" }),
      });
      
      const result = await response.json();
      
      if (result.success && result.type === "order" && result.redirectUrl) {
        // Limpiar el store de Zustand antes de redirigir
        clearCart();
        router.push(result.redirectUrl);
      } else {
        setErrorMessage(result.message || "Error al completar la orden");
        placeOrderOnceRef.current = false;
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Error al completar la orden");
      placeOrderOnceRef.current = false;
    } finally {
      setSubmitting(false);
    }
  };

  const handlePayment = () => {
    triggerHaptic("success");
    setSubmitting(true);
    onPaymentCompleted();
  };

  return (
    <>
      <Button
        data-testid="submit-order-button"
        disabled={notReady}
        isLoading={submitting}
        onClick={handlePayment}
        size="large"
      >
        Pagar
      </Button>
      <ErrorMessage
        data-testid="manual-payment-error-message"
        error={validationMessage || errorMessage}
      />
    </>
  );
};

export default PaymentButton;
