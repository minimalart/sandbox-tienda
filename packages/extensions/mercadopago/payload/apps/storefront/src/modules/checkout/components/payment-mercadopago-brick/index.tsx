"use client";

import { initMercadoPago, Payment as MpPaymentBrick } from "@mercadopago/sdk-react";
import type { HttpTypes } from "@medusajs/types";
import type { ComponentProps } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ErrorMessage from "../error-message";
import { registerMpApiSubmit, registerMpApiValidate } from "./bridge";

type PaymentSession = { provider_id: string; status: string; id: string };

type Props = {
  cart: HttpTypes.StoreCart;
  /** MP public key for this tenant/sales channel (from tenant.assets.mercadopago). */
  publicKey: string;
};

type BrickController = {
  getFormData?: () => Promise<Record<string, unknown> | { formData?: Record<string, unknown> }>;
};

const pendingSession = (cart: HttpTypes.StoreCart): PaymentSession | undefined =>
  (cart.payment_collection?.payment_sessions as PaymentSession[] | undefined)?.find(
    (s) => s.status === "pending",
  );

/**
 * MercadoPago **Checkout API** embedded payment (Payment Brick).
 *
 * Renders the card / cash / installments form inline as soon as the method is
 * picked. MP's native pay button is hidden (`visual.hidePaymentButton`); the
 * checkout's single "Finalizar compra" button drives submission via the bridge
 * (`registerMpApiSubmit`) — it pulls the tokenized form data from the Brick
 * controller (`getFormData`), POSTs it to `/store/mercadopago/payment`, and the
 * backend + its webhook create the payment/order. We then send the buyer to
 * /checkout/success (same return flow as Checkout Express).
 */
const MercadoPagoBrick = ({ cart, publicKey }: Props) => {
  const [ready, setReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const initedRef = useRef(false);

  // Latest cart in a ref so the (bridge-triggered) submit always reads current
  // values — the handler is registered once and would otherwise close over a
  // stale cart/session.
  const cartRef = useRef(cart);
  cartRef.current = cart;

  useEffect(() => {
    if (initedRef.current || !publicKey) return;
    initedRef.current = true;
    initMercadoPago(publicKey, { locale: "es-AR" });
    setReady(true);
  }, [publicKey]);

  // Load MercadoPago's device fingerprint script (improves approval rates).
  useEffect(() => {
    const existing = document.querySelector('script[src*="security.js"]');
    if (existing) return;
    const script = document.createElement("script");
    script.src = "https://www.mercadopago.com/v2/security.js";
    script.setAttribute("view", "checkout");
    document.body.appendChild(script);
  }, []);

  // Core payment step: takes the Brick's form data (token / payment_method_id /
  // installments / payer / transaction_amount), POSTs it, and on success routes
  // to the success page. Returns true when it initiated navigation.
  const processPayment = useCallback(
    async (formData: Record<string, unknown>): Promise<boolean> => {
      const activeCart = cartRef.current;
      const activeSession = pendingSession(activeCart);
      if (!activeSession) {
        setErrorMessage(
          "La sesión de pago todavía no está lista. Esperá unos segundos e intentá de nuevo.",
        );
        return false;
      }

      setErrorMessage(null);
      const amount = Number(activeCart.total ?? 0);
      const payer = (formData.payer ?? {}) as Record<string, unknown>;
      const paymentData = {
        ...formData,
        transaction_amount: (formData.transaction_amount as number) ?? amount,
        payer: { ...payer, email: (payer.email as string) || activeCart.email },
      };

      const deviceSessionId = (window as unknown as { MP_DEVICE_SESSION_ID?: string })
        .MP_DEVICE_SESSION_ID;

      try {
        const res = await fetch("/api/store/mercadopago/payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentSessionId: activeSession.id,
            cart_id: activeCart.id,
            paymentData,
            device_session_id: deviceSessionId,
          }),
        });
        const result = await res.json().catch(() => ({}));

        if (!res.ok) {
          setErrorMessage(
            result?.message || "No pudimos procesar el pago. Probá con otra tarjeta.",
          );
          return false;
        }

        // Payment created in MP. Route to the success page, which polls for the
        // order created by the webhook (approved/authorized) or falls through to
        // pending for offline/in-review payments.
        const status = (result?.status as string | undefined) ?? "pending";
        const collectionStatus =
          status === "approved" || status === "authorized" ? "approved" : "pending";
        document.cookie = `mp_payment_pending=${Date.now()}; path=/; max-age=3600; SameSite=Lax`;
        const base = window.location.pathname.replace(/\/checkout.*$/, "/checkout");
        const params = new URLSearchParams({
          external_reference: activeCart.id,
          collection_status: collectionStatus,
          ...(result?.payment_id ? { payment_id: String(result.payment_id) } : {}),
        });
        window.location.href = `${base}/success?${params.toString()}`;
        return true;
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : "Error al procesar el pago");
        return false;
      }
    },
    [],
  );

  // Bridge submit: pull the (tokenized) form data straight from the Brick
  // controller and process it. This is MP's documented pattern for a custom pay
  // button (visual.hidePaymentButton). getFormData() rejects on an invalid form
  // and the Brick highlights the fields itself, so we just bail out quietly.
  const submitFromExternalButton = useCallback(async (): Promise<boolean> => {
    const controller = (window as unknown as { paymentBrickController?: BrickController })
      .paymentBrickController;
    if (!controller?.getFormData) {
      setErrorMessage(
        "El formulario de pago todavía no está listo. Esperá unos segundos e intentá de nuevo.",
      );
      return false;
    }
    let formData: Record<string, unknown> | undefined;
    try {
      const raw = await controller.getFormData();
      formData = ((raw as { formData?: Record<string, unknown> })?.formData ??
        raw) as Record<string, unknown>;
    } catch {
      // Invalid/incomplete form — the Brick shows the validation errors inline.
      return false;
    }
    if (!formData) return false;
    return processPayment(formData);
  }, [processPayment]);

  // Validate the form without paying: powers "Confirmar datos de pago", which
  // gates session creation so "Finalizar compra" only enables once the data is
  // loaded. getFormData() rejects on an invalid form and the Brick highlights
  // the fields itself.
  const validateForm = useCallback(async (): Promise<boolean> => {
    const controller = (window as unknown as { paymentBrickController?: BrickController })
      .paymentBrickController;
    if (!controller?.getFormData) {
      setErrorMessage(
        "El formulario de pago todavía no está listo. Esperá unos segundos e intentá de nuevo.",
      );
      return false;
    }
    try {
      await controller.getFormData();
      setErrorMessage(null);
      return true;
    } catch {
      return false;
    }
  }, []);

  // Register the external actions so the payment step / summary buttons drive
  // this Brick (its own pay button is hidden).
  useEffect(() => {
    registerMpApiSubmit(submitFromExternalButton);
    registerMpApiValidate(validateForm);
    return () => {
      registerMpApiSubmit(null);
      registerMpApiValidate(null);
    };
  }, [submitFromExternalButton, validateForm]);

  const amount = Number(cart.total ?? 0);

  // Memoize the Brick inputs so @mercadopago/sdk-react mounts the Brick exactly
  // once. New object/function identities on every render make the SDK tear down
  // and re-create the Brick, and its async create()/unmount() race leaves a
  // DUPLICATE iframe in the DOM (the "doubled payment form" bug). Stable deps →
  // single mount.
  const initialization = useMemo(
    () => ({ amount, payer: cart.email ? { email: cart.email } : undefined }),
    [amount, cart.email],
  );
  const customization = useMemo(
    () =>
      ({
        paymentMethods: {
          creditCard: "all",
          debitCard: "all",
          ticket: "all",
        },
        // Hide MP's native pay button — the checkout's "Finalizar compra" is the
        // single CTA for both MercadoPago checkouts.
        visual: { hidePaymentButton: true },
      }) as ComponentProps<typeof MpPaymentBrick>["customization"],
    [],
  );
  const onSubmit = useCallback(
    // Fallback: if MP ever submits internally (it shouldn't with the button
    // hidden), route it through the same processing path.
    async ({ formData }: { formData: Record<string, unknown> }) => {
      await processPayment(formData);
    },
    [processPayment],
  ) as unknown as ComponentProps<typeof MpPaymentBrick>["onSubmit"];
  const onError = useCallback((err: { message?: string }) => {
    setErrorMessage(err?.message || "Error en el formulario de pago");
  }, []);

  if (!publicKey) {
    return (
      <ErrorMessage
        data-testid="mercadopago-brick-error-message"
        error="MercadoPago no está configurado para esta tienda (falta la public key)."
      />
    );
  }

  return (
    <div className="mt-2">
      {ready && (
        <MpPaymentBrick
          initialization={initialization}
          customization={customization}
          onSubmit={onSubmit}
          onError={onError}
        />
      )}
      {!ready && (
        <p className="mt-2 text-sm text-ui-fg-subtle">
          Preparando el formulario de pago…
        </p>
      )}
      <ErrorMessage
        data-testid="mercadopago-brick-error-message"
        error={errorMessage}
      />
    </div>
  );
};

export default MercadoPagoBrick;
