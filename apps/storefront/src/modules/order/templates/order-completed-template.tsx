import type { HttpTypes } from "@medusajs/types";
import { Heading } from "@medusajs/ui";
import Image from "next/image";

import Items from "@modules/order/components/items";
import OnboardingCta from "@modules/order/components/onboarding-cta";
import OrderDetails from "@modules/order/components/order-details";
import OrderSummaryTotals from "@modules/order/components/order-summary-totals";
import OrderSuccessAnimation from "@modules/order/components/order-success-animation";
import PaymentDetails from "@modules/order/components/payment-details";
import ShippingDetails from "@modules/order/components/shipping-details";
import TransportConditionNotice from "@modules/common/components/transport-condition-notice";
import { cookies as nextCookies } from "next/headers";

type OrderCompletedTemplateProps = {
  order: HttpTypes.StoreOrder;
  /**
   * El comprador ya vio la animación en la pantalla de retorno de MercadoPago
   * (/checkout/success o /checkout/pending). Sin esto se reproduce dos veces
   * seguidas, sonido incluido.
   */
  celebrated?: boolean;
};

export default async function OrderCompletedTemplate({
  order,
  celebrated = false,
}: OrderCompletedTemplateProps) {
  const cookies = await nextCookies();

  const isOnboarding = cookies.get("_medusa_onboarding")?.value === "true";

  const pendingPayment =
    order.status !== "canceled" &&
    order.payment_status !== "captured" &&
    order.payment_status !== "refunded";

  return (
    <>
      {/* GA4 purchase se emite server-side vía el plugin de backend
          (@variablevic/google-analytics-medusa) cuando se coloca la orden, no
          acá. Es más confiable: no lo bloquea un ad-blocker ni se pierde si el
          usuario cierra la pestaña tras pagar (clave en el flujo de redirect
          de MercadoPago). La atribución usa cart.metadata.ga_client_id. */}
      {!celebrated && (
        <OrderSuccessAnimation
          orderId={order.id}
          pendingPayment={pendingPayment}
        />
      )}
      <div className="min-h-[calc(100vh-64px)] py-6">
        <div className="content-container flex w-full max-w-7xl flex-col gap-[25px] py-6">
          {isOnboarding && <OnboardingCta orderId={order.id} />}
          <section className="flex w-full flex-col items-center gap-4 pt-4">
            <span
              className={`flex h-20 w-20 items-center justify-center rounded-full ${
                pendingPayment ? "bg-[#FEF3C7]" : "bg-[#DCFCE7]"
              }`}
            >
              {pendingPayment ? (
                <span
                  aria-hidden
                  className="text-3xl text-[#D97706]"
                  role="img"
                >
                  ⏳
                </span>
              ) : (
                <Image
                  alt="Orden confirmada"
                  height={40}
                  src="/CircleCheckBig.svg"
                  width={40}
                />
              )}
            </span>
            <Heading
              className="text-center font-bold text-[40px] leading-[40px] text-[#111827] max-md:text-3xl max-md:leading-9"
              level="h1"
            >
              {pendingPayment
                ? "¡Recibimos tu pedido!"
                : "¡Gracias por tu compra!"}
            </Heading>
            {pendingPayment && (
              <div
                className="w-full max-w-2xl rounded-xl border border-[#FCD34D] bg-[#FFFBEB] p-4 text-center text-sm text-[#92400E]"
                data-testid="pending-payment-banner"
              >
                Estamos esperando la confirmación del pago. Tu pedido fue
                registrado pero todavía no procesamos el pago. Una vez
                confirmado, comenzaremos a prepararlo y te avisaremos por correo electrónico.
              </div>
            )}
            <OrderDetails order={order} pendingPayment={pendingPayment} />
          </section>

          <section
            className="grid w-full grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,782px)_minmax(0,391px)]"
            data-testid="order-complete-container"
          >
            <div className="rounded-2xl border border-[#E5E7EB] bg-white p-[16px] shadow-[0_10px_20px_0_#0000000D]">
              <Heading className="text-[18px] font-semibold text-[--text-dark]" level="h2">
                Detalle del pedido
              </Heading>
              <TransportConditionNotice
                className="mt-4"
                items={order.items ?? []}
              />
              <div className="mt-6">
                <Items order={order} />
              </div>
              <OrderSummaryTotals totals={order} />
            </div>

            <div className="flex flex-col gap-6">
              <ShippingDetails order={order} />
              <PaymentDetails order={order} />
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
