"use client";

import {
  CreditCardIcon,
  GiftIcon,
  MapPinIcon,
  TruckIcon,
  UserIcon,
} from "@heroicons/react/24/outline";
import { buildShippingAddressKey } from "@lib/util/shipping-address-key";
import { goToCheckoutStep } from "@lib/util/checkout-step";
import isAddressComplete from "@lib/util/validate-address";
import type { HttpTypes } from "@medusajs/types";
import Addresses from "@modules/checkout/components/addresses";
import CheckoutStep from "@modules/checkout/components/checkout-step";
import DiscountCode from "@modules/checkout/components/discount-code";
import GiftCardCode from "@modules/checkout/components/gift-card-code";
import LoyaltyRewardsCheckout from "@minimalart/mercatto-plugin-loyalty/storefront/checkout/loyalty-rewards-checkout";
import Payment from "@modules/checkout/components/payment";
import PersonalInfo from "@modules/checkout/components/personal-info";
import Shipping from "@modules/checkout/components/shipping";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type PaymentMethod = { id: string };
type PaymentSession = { provider_id: string; status: string; id: string };

function BenefitsContinueButton() {
  return (
    <button
      className="mt-4 w-full rounded-lg bg-[--primary-color] px-4 py-3 font-medium text-sm text-white hover:opacity-90"
      onClick={() => goToCheckoutStep("payment")}
      type="button"
    >
      Continuar al pago
    </button>
  );
}

type CheckoutFormClientProps = {
  googleMapsApiKey: string;
  cart: HttpTypes.StoreCart;
  customer: HttpTypes.StoreCustomer | null;
  onCartUpdate?: (cart?: HttpTypes.StoreCart | null) => Promise<HttpTypes.StoreCart | null>;
};

export default function CheckoutFormClient({
  googleMapsApiKey,
  cart,
  customer,
  onCartUpdate,
}: CheckoutFormClientProps) {
  const [shippingMethods, setShippingMethods] = useState<
    HttpTypes.StoreCartShippingOption[] | null
  >(null);
  const [shippingCoverage, setShippingCoverage] = useState<
    { evaluated: boolean; covered: boolean } | undefined
  >(undefined);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[] | null>(
    null,
  );
  // MercadoPago Checkout API public key for the active tenant (needed by the
  // embedded Payment Brick).
  const [mercadopagoPublicKey, setMercadopagoPublicKey] = useState<string | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  // Recálculo de shipping en curso (cambió la dirección, no el cart entero):
  // el paso delivery lo usa para no mostrar la lista vieja como si fuera
  // válida mientras se pide de nuevo.
  const [shippingLoading, setShippingLoading] = useState(true);
  // El fetch de payment providers sigue atado a cart.id/region — se guarda
  // igual que antes para no repetirlo en cada render.
  const hasFetchedPayment = useRef(false);
  const paymentCartIdRef = useRef<string | null>(null);
  // `loading` (el skeleton de la página entera) tiene que esperar al primer
  // fetch de AMBOS — shipping y payment —, pero ahora corren en efectos
  // separados. Cada uno descuenta este contador al terminar su primera
  // pasada; cuando llega a 0, se apaga el skeleton. Los refetch de shipping
  // posteriores (cambio de dirección) siguen descontando pero ya no hay
  // nada que hacer una vez en 0 — es idempotente.
  const pendingInitialFetchesRef = useRef(2);
  const searchParams = useSearchParams();
  const currentStep = searchParams.get("step") || "personal";

  // Step completion checks
  const emailComplete = !!cart?.email;
  const addressComplete = useMemo(
    () => isAddressComplete(cart?.shipping_address),
    [cart?.shipping_address],
  );
  const shippingComplete = useMemo(
    () => (cart?.shipping_methods?.length ?? 0) > 0,
    [cart?.shipping_methods],
  );
  const activeSession = cart?.payment_collection?.payment_sessions?.find(
    (s: PaymentSession) => s.status === "pending",
  );
  const paymentComplete = !!activeSession;

  // Step order and prerequisites
  const stepOrder = [
    "personal",
    "address",
    "delivery",
    "benefits",
    "payment",
  ] as const;
  const stepPrereqs: Record<string, boolean> = {
    personal: true,
    address: emailComplete,
    delivery: emailComplete && addressComplete,
    benefits: emailComplete && addressComplete && shippingComplete,
    payment: emailComplete && addressComplete && shippingComplete,
  };

  // Determine the effective step: if prerequisites aren't met, fall back to the earliest incomplete step
  const effectiveStep = useMemo(() => {
    if (stepPrereqs[currentStep]) {
      return currentStep;
    }
    // Find the first step whose prerequisites are NOT met
    for (const step of stepOrder) {
      if (!stepPrereqs[step]) {
        // Go to the step before this one (the last accessible)
        const idx = stepOrder.indexOf(step);
        return idx > 0 ? stepOrder[idx - 1] : stepOrder[0];
      }
    }
    return "personal";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, emailComplete, addressComplete, shippingComplete]);

  const goToStep = useCallback(
    (step: string) => {
      // Only allow navigating to a step if its prerequisites are met
      if (stepPrereqs[step]) {
        goToCheckoutStep(step);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [emailComplete, addressComplete, shippingComplete],
  );

  // Redirect if the URL step doesn't match the effective step.
  // Use a short delay to allow cart state updates to propagate before
  // deciding whether to redirect (avoids race condition when navigating
  // right after onCartUpdate sets new cart state).
  useEffect(() => {
    if (currentStep === effectiveStep) return;
    const timer = setTimeout(() => {
      goToCheckoutStep(effectiveStep, { replace: true });
    }, 100);
    return () => clearTimeout(timer);
  }, [currentStep, effectiveStep]);

  // Track which steps the user has actually submitted (i.e., advanced past via
  // the Continue button or otherwise moved forward in the step order). A step
  // only enters the "Editando" badge state when it has been submitted at least
  // once AND is currently open — auto-completion of data alone is not enough.
  const [submittedSteps, setSubmittedSteps] = useState<Set<string>>(
    () => new Set(),
  );
  const previousStepRef = useRef<string>(currentStep);
  useEffect(() => {
    const prev = previousStepRef.current;
    if (prev === currentStep) return;
    const order = stepOrder as readonly string[];
    const prevIdx = order.indexOf(prev);
    const curIdx = order.indexOf(currentStep);
    const markAsSubmitted = (step: string) => {
      setSubmittedSteps((current) => {
        if (current.has(step)) return current;
        const next = new Set(current);
        next.add(step);
        return next;
      });
    };
    if (prevIdx >= 0 && curIdx > prevIdx) {
      // Forward navigation: the user advanced past the previous step.
      markAsSubmitted(prev);
    } else if (prev === "payment" && paymentComplete) {
      // Payment is the last step and has no forward to advance to. Treat any
      // departure from it while complete as "submitted" so reopens show the
      // edit state.
      markAsSubmitted("payment");
    }
    previousStepRef.current = currentStep;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, paymentComplete]);

  // Clave estable de la dirección de envío: NO se puede usar
  // `cart.shipping_address` directo como dep porque el cart llega como
  // objeto nuevo en cada render (setCart en el padre) y eso dispararía el
  // efecto de shipping en cada render, no solo cuando la dirección cambia de
  // verdad. Ver shipping-address-key.ts para el detalle de qué campos entran
  // y por qué el orden lat/lng espeja al backend.
  const shippingAddressKey = useMemo(
    () => buildShippingAddressKey(cart?.shipping_address),
    [cart?.shipping_address],
  );

  // Payment providers + MercadoPago: se piden una vez por cart/región, igual
  // que antes de partir este efecto en dos. No depende de la dirección — el
  // bug era sólo del lado de shipping.
  useEffect(() => {
    if (hasFetchedPayment.current && paymentCartIdRef.current === cart.id) {
      return;
    }
    if (!cart?.id) {
      pendingInitialFetchesRef.current -= 1;
      if (pendingInitialFetchesRef.current <= 0) setLoading(false);
      return;
    }

    paymentCartIdRef.current = cart.id;
    hasFetchedPayment.current = true;

    const fetchPaymentMethods = async () => {
      try {
        const paymentResponse = await fetch(
          `/api/store/payment-providers?region_id=${cart.region?.id ?? ""}&amount=${Number(cart.total ?? 0)}`,
        );

        if (!paymentResponse.ok) {
          throw new Error("Failed to fetch payment providers");
        }

        const paymentData = await paymentResponse.json();
        const providers = Array.isArray(paymentData.payment_providers)
          ? (paymentData.payment_providers as PaymentMethod[])
          : [];
        setPaymentMethods(providers);
        setMercadopagoPublicKey(paymentData?.mercadopago?.publicKey ?? null);
      } catch (error) {
        console.error("Error fetching payment providers:", error);
        setPaymentMethods([]);
      } finally {
        pendingInitialFetchesRef.current -= 1;
        if (pendingInitialFetchesRef.current <= 0) setLoading(false);
      }
    };

    fetchPaymentMethods();
  }, [cart.id, cart.region?.id]);

  // Shipping options: a diferencia de payment, esto TIENE que volver a
  // pedirse cada vez que cambia la dirección — el gate de cobertura del
  // backend (shippingCoverageGate) recalcula `shipping_coverage` y filtra la
  // flota propia según `shipping_address`, y hasta que no exista dirección
  // en el cart responde fail-open (sin la clave `shipping_coverage`).
  // AbortController evita que una respuesta vieja pise a una más nueva si el
  // usuario cambia la dirección dos veces rápido.
  useEffect(() => {
    if (!cart?.id) {
      pendingInitialFetchesRef.current -= 1;
      if (pendingInitialFetchesRef.current <= 0) setLoading(false);
      setShippingLoading(false);
      return;
    }

    const controller = new AbortController();
    setShippingLoading(true);

    const fetchShippingOptions = async () => {
      try {
        const shippingResponse = await fetch(
          `/api/store/shipping-options?cart_id=${cart.id}`,
          { signal: controller.signal },
        );

        if (!shippingResponse.ok) {
          throw new Error("Failed to fetch shipping options");
        }

        const shippingData = await shippingResponse.json();
        const options = Array.isArray(shippingData.shipping_options)
          ? (shippingData.shipping_options as HttpTypes.StoreCartShippingOption[])
          : [];
        setShippingMethods(options);
        setShippingCoverage(shippingData.shipping_coverage);
      } catch (error) {
        if ((error as Error)?.name === "AbortError") {
          // Efecto cancelado porque la dirección ya cambió de nuevo: esta
          // respuesta quedó vieja, se descarta en silencio.
          return;
        }
        console.error("Error fetching shipping options:", error);
        setShippingMethods([]);
        setShippingCoverage(undefined);
      } finally {
        // Si este fetch fue abortado, el próximo efecto ya está en curso y
        // es el único que debe tocar loading/shippingLoading.
        if (!controller.signal.aborted) {
          pendingInitialFetchesRef.current -= 1;
          if (pendingInitialFetchesRef.current <= 0) setLoading(false);
          setShippingLoading(false);
        }
      }
    };

    fetchShippingOptions();

    return () => controller.abort();
  }, [cart.id, shippingAddressKey]);

  // Must be declared before any early returns to respect Rules of Hooks
  const cartMetadata = (cart as any).metadata as
    | Record<string, string>
    | undefined;
  const shippingSummary = useMemo(() => {
    if (!shippingComplete) return undefined;
    const methodName =
      cart.shipping_methods?.[cart.shipping_methods.length - 1]?.name;
    if (
      cartMetadata?.shipping_method === "retiro_sucursal" &&
      cartMetadata.pickup_branch_name
    ) {
      return `${methodName} — ${cartMetadata.pickup_branch_name}`;
    }
    if (
      cartMetadata?.shipping_method === "retiro_store" &&
      cartMetadata.store_name
    ) {
      return `${methodName} — ${cartMetadata.store_name}`;
    }
    if (
      cartMetadata?.shipping_method === "retiro_cde" &&
      cartMetadata.selected_cde_name
    ) {
      return `${methodName} — ${cartMetadata.selected_cde_name}`;
    }
    return methodName;
  }, [shippingComplete, cart.shipping_methods, cartMetadata]);

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            className="rounded-xl border border-gray-200 bg-white p-5"
            key={i}
          >
            <div className="flex items-center gap-3">
              <div className="h-7 w-7 animate-pulse rounded-full bg-gray-200" />
              <div className="h-4 w-32 animate-pulse rounded-lg bg-gray-200" />
            </div>
            {i === 1 && (
              <div className="mt-4 space-y-3">
                <div className="h-10 w-full animate-pulse rounded-lg bg-gray-200" />
                <div className="h-10 w-full animate-pulse rounded-lg bg-gray-200" />
                <div className="h-10 w-2/3 animate-pulse rounded-lg bg-gray-200" />
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (shippingMethods === null || paymentMethods === null) {
    return (
      <div className="py-12 text-gray-600 text-sm">
        No se pudieron cargar las opciones de checkout.
      </div>
    );
  }

  const addressSummary = addressComplete
    ? `${cart.shipping_address?.address_1}, ${cart.shipping_address?.city}`
    : undefined;

  return (
    <div className="flex w-full flex-col gap-4">
      {/* Step 1: Datos personales */}
      <CheckoutStep
        completedSummary={emailComplete ? cart.email : undefined}
        icon={<UserIcon className="h-4 w-4" />}
        isCompleted={emailComplete && effectiveStep !== "personal"}
        isEditing={
          effectiveStep === "personal" && submittedSteps.has("personal")
        }
        isOpen={effectiveStep === "personal" || !emailComplete}
        onEdit={() => goToStep("personal")}
        stepNumber={1}
        title="Datos personales"
      >
        <PersonalInfo
          cart={cart}
          customer={customer}
          onCartUpdate={onCartUpdate}
        />
      </CheckoutStep>

      {/* Step 2: Datos de envío */}
      <CheckoutStep
        completedSummary={addressSummary}
        icon={<MapPinIcon className="h-4 w-4" />}
        isCompleted={addressComplete && effectiveStep !== "address"}
        isEditing={
          effectiveStep === "address" && submittedSteps.has("address")
        }
        isOpen={effectiveStep === "address"}
        onEdit={emailComplete ? () => goToStep("address") : undefined}
        stepNumber={2}
        title="Datos de envío"
      >
        <Addresses
          cart={cart}
          customer={customer}
          googleMapsApiKey={googleMapsApiKey}
          onCartUpdate={onCartUpdate}
        />
      </CheckoutStep>

      {/* Step 3: Tipo de envío */}
      <CheckoutStep
        completedSummary={shippingSummary}
        icon={<TruckIcon className="h-4 w-4" />}
        isCompleted={shippingComplete && effectiveStep !== "delivery"}
        isEditing={
          effectiveStep === "delivery" && submittedSteps.has("delivery")
        }
        isOpen={effectiveStep === "delivery"}
        onEdit={
          emailComplete && addressComplete
            ? () => goToStep("delivery")
            : undefined
        }
        stepNumber={3}
        title="Tipo de envío"
      >
        <Shipping
          availableShippingMethods={shippingMethods}
          cart={cart}
          onCartUpdate={onCartUpdate}
          refreshingOptions={shippingLoading}
          shippingCoverage={shippingCoverage}
        />
      </CheckoutStep>

      {/* Step 4: Beneficios */}
      <CheckoutStep
        icon={<GiftIcon className="h-4 w-4" />}
        isCompleted={
          effectiveStep !== "benefits" &&
          (effectiveStep === "payment" || paymentComplete)
        }
        isEditing={
          effectiveStep === "benefits" && submittedSteps.has("benefits")
        }
        isOpen={effectiveStep === "benefits"}
        onEdit={
          emailComplete && addressComplete && shippingComplete
            ? () => goToStep("benefits")
            : undefined
        }
        stepNumber={4}
        title="Beneficios"
      >
        <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4 sm:p-5">
          <DiscountCode
            cart={
              cart as HttpTypes.StoreCart & {
                promotions: HttpTypes.StorePromotion[];
              }
            }
            onCartUpdate={onCartUpdate}
          />
          <GiftCardCode cart={cart} onCartUpdate={onCartUpdate} />
          <LoyaltyRewardsCheckout cart={cart} onCartUpdate={onCartUpdate} />
        </div>
        <BenefitsContinueButton />
      </CheckoutStep>

      {/* Step 5: Forma de pago */}
      <CheckoutStep
        icon={<CreditCardIcon className="h-4 w-4" />}
        isCompleted={paymentComplete}
        isEditing={
          effectiveStep === "payment" && submittedSteps.has("payment")
        }
        isOpen={effectiveStep === "payment"}
        onEdit={
          emailComplete && addressComplete && shippingComplete
            ? () => goToStep("payment")
            : undefined
        }
        stepNumber={5}
        title="Forma de pago"
      >
        <Payment
          availablePaymentMethods={paymentMethods}
          cart={cart}
          mercadopagoPublicKey={mercadopagoPublicKey}
          onCartUpdate={onCartUpdate}
        />
      </CheckoutStep>
    </div>
  );
}
