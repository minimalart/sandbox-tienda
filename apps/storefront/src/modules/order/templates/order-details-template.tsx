"use client";

import { formatDateAR, formatDateTimeAR } from "@lib/util/format-date";
import { getTracking } from "@lib/util/get-tracking";
import { convertToLocale } from "@lib/util/money";
import {
  handleImageError,
  PLACEHOLDER_IMAGE,
} from "@lib/util/placeholder-image";
import type { HttpTypes } from "@medusajs/types";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import TintColorLabel from "@modules/common/components/tint-color-label";
import TransportConditionBadge from "@modules/common/components/transport-condition-badge";
import TransportConditionNotice from "@modules/common/components/transport-condition-notice";
import InvoiceDownload from "@modules/order/components/invoice-download";
import ReturnRequestModal from "@modules/order/components/return-request";
import { DollarSign, MapPin, Package, Truck } from "lucide-react";
import type React from "react";
import { useMemo, useState } from "react";

type OrderDetailsTemplateProps = {
  order: HttpTypes.StoreOrder;
};

type TimelineStep = {
  label: string;
  done: boolean;
  date?: string | null;
  icon: React.ReactNode;
};

const isPaymentPending = (paymentStatus: string, orderStatus: string) => {
  if (orderStatus === "canceled") return false;
  return paymentStatus !== "captured" && paymentStatus !== "refunded";
};

const getStatusBadge = (
  orderStatus: string,
  fulfillmentStatus: string,
  paymentStatus: string,
) => {
  if (orderStatus === "canceled" || fulfillmentStatus === "canceled") {
    return { label: "Cancelado", className: "bg-[#FFE2E2] text-[#C10007]" };
  }
  if (isPaymentPending(paymentStatus, orderStatus)) {
    return {
      label: "Pago pendiente",
      className: "bg-[#FEF3C7] text-[#92400E]",
    };
  }
  if (fulfillmentStatus === "delivered") {
    return { label: "Entregado", className: "bg-[#DCFCE7] text-[#008236]" };
  }
  if (fulfillmentStatus === "shipped" || fulfillmentStatus === "partially_shipped") {
    return { label: "Enviado", className: "bg-[#DBEAFE] text-[#1447E6]" };
  }
  if (fulfillmentStatus === "fulfilled" || fulfillmentStatus === "partially_fulfilled") {
    return { label: "En preparación", className: "bg-[#DBEAFE] text-[#1447E6]" };
  }
  if (fulfillmentStatus === "returned") {
    return { label: "Devuelto", className: "bg-orange-100 text-orange-700" };
  }
  return { label: "Pendiente", className: "bg-gray-100 text-gray-600" };
};

const getTimelineSteps = (order: HttpTypes.StoreOrder): TimelineStep[] => {
  const fs = order.fulfillment_status;
  const ps = order.payment_status;
  const paymentDone = ps === "captured" || ps === "refunded";
  // Regla de negocio: no exponer avance de fulfillment si el pago no está confirmado.
  const preparingDone =
    paymentDone &&
    ["partially_fulfilled", "fulfilled", "partially_shipped", "shipped", "delivered"].includes(fs);
  const shippedDone =
    paymentDone && ["partially_shipped", "shipped", "delivered"].includes(fs);
  const deliveredDone = paymentDone && fs === "delivered";

  const paymentDate = (order as any).payment_collections?.[0]?.payments?.[0]?.created_at;
  const fulfillmentDate = (order as any).fulfillments?.[0]?.created_at;
  const shippedDate = (order as any).fulfillments?.[0]?.shipped_at;
  const deliveredDate = (order as any).fulfillments?.[0]?.delivered_at;

  return [
    { label: "Pedido realizado", done: true, date: order.created_at, icon: <DollarSign size={14} /> },
    {
      label: paymentDone ? "Pago confirmado" : "Pago no confirmado",
      done: paymentDone,
      date: paymentDone ? paymentDate ?? order.created_at : null,
      icon: <DollarSign size={14} />,
    },
    {
      label: "En preparación",
      done: preparingDone,
      date: preparingDone ? fulfillmentDate : null,
      icon: <Package size={14} />,
    },
    {
      label: "Enviado",
      done: shippedDone,
      date: shippedDone ? shippedDate ?? fulfillmentDate : null,
      icon: <Truck size={14} />,
    },
    {
      label: "Entregado",
      done: deliveredDone,
      date: deliveredDone ? deliveredDate ?? null : null,
      icon: <MapPin size={14} />,
    },
  ];
};

const formatStepDate = (dateStr?: string | null) =>
  formatDateTimeAR(dateStr, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const CheckIcon = () => (
  <svg
    fill="none"
    height="14"
    stroke="currentColor"
    strokeWidth="3"
    viewBox="0 0 24 24"
    width="14"
    xmlns="http://www.w3.org/2000/svg"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const CopyIcon = () => (
  <svg
    fill="none"
    height="14"
    stroke="currentColor"
    strokeWidth="2"
    viewBox="0 0 24 24"
    width="14"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect height="14" rx="2" ry="2" width="14" x="8" y="8" />
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
  </svg>
);

const BackIcon = () => (
  <svg
    fill="none"
    height="16"
    stroke="currentColor"
    strokeWidth="2.5"
    viewBox="0 0 24 24"
    width="16"
    xmlns="http://www.w3.org/2000/svg"
  >
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const OrderDetailsTemplate: React.FC<OrderDetailsTemplateProps> = ({ order }) => {
  const [copied, setCopied] = useState(false);
  const [showAllProductsMobile, setShowAllProductsMobile] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  // Elegible para devolución: solo cuando el pedido está entregado (y no
  // cancelado). El botón se muestra siempre pero queda deshabilitado hasta
  // ese estado.
  const isDelivered =
    order.status !== "canceled" &&
    order.fulfillment_status === "delivered";

  const orderYear = new Date(order.created_at).getFullYear();
  const orderNumber = `ORD-${orderYear}-${String(order.custom_display_id ?? order.display_id).padStart(3, "0")}`;
  const orderDate = formatDateAR(order.created_at);

  const status = getStatusBadge(
    order.status,
    order.fulfillment_status,
    order.payment_status,
  );
  const timelineSteps = getTimelineSteps(order);
  const pendingPayment = isPaymentPending(order.payment_status, order.status);

  const tracking = getTracking(order);

  const handleCopyTracking = () => {
    if (!tracking) return;
    navigator.clipboard.writeText(tracking.number);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getAmount = (amount?: number | null) => {
    if (amount === undefined || amount === null) return null;
    return `$ ${convertToLocale({ amount, currency_code: order.currency_code })}`;
  };

  const items = useMemo(
    () =>
      [...(order.items ?? [])].sort((a, b) =>
        (a.created_at ?? "") > (b.created_at ?? "") ? -1 : 1,
      ),
    [order.items],
  );
  const mobileItems = showAllProductsMobile ? items : items.slice(0, 5);
  const shouldShowMobileProductsToggle = items.length > 5 && !showAllProductsMobile;

  const shippingAddress = order.shipping_address;

  return (
    <div className="flex flex-col gap-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <LocalizedClientLink
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-ui-border-base text-[--primary-color] transition-colors hover:bg-ui-bg-subtle"
            data-testid="back-to-overview-button"
            href="/account"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M15.75 19.5L8.25 12L15.75 4.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </LocalizedClientLink>
          <div>
            <h1 className="text-xl font-bold text-[#111827]">{orderNumber}</h1>
            <p className="text-sm font-normal text-[#111827]">Realizada el {orderDate}</p>
          </div>
        </div>
        {/* Estado + comprobante + Solicitar devolución. El botón de devolución
            está siempre visible y solo se habilita cuando el pedido está
            entregado; el del comprobante se dibuja solo si el ERP ya facturó. */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <InvoiceDownload orderId={order.id} />
          <span
            className={`rounded-full px-3 py-1 text-sm font-[500] ${status.className}`}
          >
            {status.label}
          </span>
          <button
            className={`rounded-xl px-4 py-2 font-medium text-sm transition-colors ${
              isDelivered
                ? "bg-[var(--primary-color)] text-white hover:opacity-90"
                : "cursor-not-allowed bg-gray-100 text-gray-400"
            }`}
            disabled={!isDelivered}
            onClick={() => setReturnOpen(true)}
            title={
              isDelivered
                ? undefined
                : "Vas a poder solicitar la devolución cuando el pedido esté entregado."
            }
            type="button"
          >
            Solicitar devolución
          </button>
        </div>
      </div>

      <ReturnRequestModal
        onClose={() => setReturnOpen(false)}
        open={returnOpen}
        order={order}
      />

      {/* Pending payment banner */}
      {pendingPayment && (
        <div
          className="flex items-start gap-3 rounded-xl border border-[#FCD34D] bg-[#FFFBEB] p-4"
          data-testid="pending-payment-banner"
        >
          <svg
            aria-hidden="true"
            className="mt-0.5 h-5 w-5 shrink-0 text-[#B45309]"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4" />
            <path d="M12 16h.01" />
          </svg>
          <div className="text-sm">
            <p className="font-semibold text-[#92400E]">
              Estamos esperando la confirmación de tu pago
            </p>
            <p className="mt-1 text-[#92400E]/90">
              Tu pedido fue registrado pero todavía no procesamos el pago. Una
              vez confirmado, comenzaremos a prepararlo y te avisaremos por
              correo electrónico.
            </p>
          </div>
        </div>
      )}

      {/* Two-column layout */}
      <div
        className="grid grid-cols-1 gap-4 lg:grid-cols-2"
        data-testid="order-details-container"
      >
        {/* Left — Seguimiento del envío */}
        <div className="rounded-xl border border-[#E0E5EB] shadow-[0px_1px_2px_0px_#0000000D] bg-white p-4">
          <h2 className="mb-4 border-b border-[#E0E5EB] pb-2 text-base font-bold text-[#111827]">
            Seguimiento del envío
          </h2>

          {/* Shipping address */}
          {shippingAddress && (
            <div className="mb-5">
              <p className="mb-1 text-[12px] font-[600] tracking-wide text-[#111827]">
                Dirección de envío
              </p>
              <p className="text-sm text-ui-fg-base">
                {shippingAddress.first_name} {shippingAddress.last_name}
              </p>
              <p className="text-sm text-ui-fg-base">
                {shippingAddress.address_1}
                {shippingAddress.address_2 ? `, ${shippingAddress.address_2}` : ""}
              </p>
              <p className="text-sm text-ui-fg-base">
                {shippingAddress.city}
                {shippingAddress.postal_code ? `, CP ${shippingAddress.postal_code}` : ""}
              </p>
            </div>
          )}

          {/* Tracking number */}
          {tracking && (
            <div className="mb-5 flex items-center gap-2">
              <a
                href={tracking.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl bg-gray-100 px-3 py-1.5 text-sm font-semibold text-[#1D2530] shadow-[0px_1px_2px_0px_#0000000D] hover:bg-gray-200 transition-colors"
              >
                {tracking.number}
              </a>
              <button
                className="flex h-8 w-8 items-center justify-center rounded text-ui-fg-subtle transition-colors hover:text-ui-fg-base"
                onClick={handleCopyTracking}
                type="button"
              >
                <CopyIcon />
              </button>
              {copied && (
                <span className="text-xs font-medium text-green-600">¡Copiado!</span>
              )}
            </div>
          )}

          {/* Timeline */}
          <div className="flex flex-col">
            {timelineSteps.map((step, index) => {
              const isPendingHighlight =
                pendingPayment && (index === 0 || index === 1);
              const circleClass = isPendingHighlight
                ? "border-2 border-[#F59E0B] bg-[#FFFBEB] text-[#B45309]"
                : step.done
                ? "bg-[#1C82AD] text-white"
                : "border-2 border-ui-border-base bg-white text-ui-fg-muted";
              const connectorClass = isPendingHighlight
                ? "bg-[#FCD34D]"
                : step.done
                ? "bg-[#1C82AD]"
                : "bg-ui-border-base";
              const labelClass = isPendingHighlight
                ? "text-[#92400E]"
                : step.done
                ? "text-ui-fg-base"
                : "text-ui-fg-muted";
              return (
                <div className="flex gap-3" key={step.label}>
                  {/* Icon + connector */}
                  <div className="flex flex-col items-center">
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${circleClass}`}
                    >
                      {!isPendingHighlight && step.done && index < 2 ? (
                        <CheckIcon />
                      ) : (
                        step.icon
                      )}
                    </div>
                    {index < timelineSteps.length - 1 && (
                      <div
                        className={`my-1 w-0.5 flex-1 ${connectorClass}`}
                        style={{ minHeight: "20px" }}
                      />
                    )}
                  </div>
                  {/* Label + date */}
                  <div className="pb-4">
                    <p className={`text-sm font-medium ${labelClass}`}>
                      {step.label}
                    </p>
                    {step.date && (
                      <p className="text-xs text-ui-fg-muted">{formatStepDate(step.date)}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right — Summary + Products */}
        <div className="flex flex-col gap-4">
          {/* Resumen del pedido */}
          <div className="rounded-xl border border-[#E0E5EB] shadow-[0px_1px_2px_0px_#0000000D] bg-white p-4">
            <h2 className="mb-4 pb-2 text-base font-bold text-[#111827]">
              Resumen del pedido
            </h2>
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-ui-fg-subtle">Subtotal</span>
                <span className="text-ui-fg-base">{getAmount(order.subtotal)}</span>
              </div>
              {order.discount_total > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-ui-fg-subtle">Descuento</span>
                  <span className="text-[#2BAB81]">- {getAmount(order.discount_total)}</span>
                </div>
              )}
              {order.gift_card_total > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-ui-fg-subtle">Gift card</span>
                  <span className="text-[#2BAB81]">- {getAmount(order.gift_card_total)}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-ui-fg-subtle">Envío</span>
                {order.shipping_total === 0 ? (
                  <span className="font-medium text-[#2BAB81]">Gratis</span>
                ) : (
                  <span className="text-ui-fg-base">{getAmount(order.shipping_total)}</span>
                )}
              </div>
              <div className="my-1 border-t border-ui-border-base" />
              <div className="flex items-center justify-between font-semibold">
                <span className="text-ui-fg-base">Total</span>
                {order.status === "canceled" ? (
                  <span className="text-[#C10007] line-through">
                    {getAmount(order.subtotal)}
                  </span>
                ) : (
                  <span className="text-ui-fg-base">{getAmount(order.total)}</span>
                )}
              </div>
            </div>
          </div>

          {/* Productos */}
          <div className="rounded-xl border border-[#E0E5EB] shadow-[0px_1px_2px_0px_#0000000D] bg-white p-4">
            <h2 className="mb-4 text-base font-bold text-[#111827]">
              Productos ({items.length})
            </h2>

            <TransportConditionNotice className="mb-4" items={items} />

            <div className="md:hidden" data-testid="products-table-mobile">
              <div className="flex flex-col gap-4">
                {mobileItems.map((item) => (
                  <div
                    className="flex items-center gap-3 rounded-xl bg-ui-bg-subtle p-3"
                    data-testid="product-row"
                    key={item.id}
                  >
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white">
                      <img
                        alt={item.product_title ?? ""}
                        className="h-full w-full object-cover"
                        onError={handleImageError}
                        src={item.thumbnail || PLACEHOLDER_IMAGE}
                      />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <p
                        className="truncate text-sm font-semibold text-ui-fg-base"
                        data-testid="product-name"
                      >
                        {item.product_title}
                      </p>
                      {item.variant?.title && (
                        <p className="truncate capitalize text-sm text-ui-fg-subtle">
                          {item.variant.title.toLowerCase()}
                        </p>
                      )}
                      <TintColorLabel
                        className="max-w-full text-sm text-ui-fg-subtle"
                        metadata={item.metadata}
                      />
                      <TransportConditionBadge
                        className="mt-1 self-start"
                        item={item}
                        size="sm"
                      />
                      <p className="mt-1 text-sm text-ui-fg-subtle">
                        Cantidad:{" "}
                        <span data-testid="product-quantity">{item.quantity}</span>
                      </p>
                    </div>
                    <div
                      className="shrink-0 self-end text-base font-semibold text-ui-fg-base flex items-center gap-1"
                      data-testid="product-price"
                    >
                      <span className="flex items-center gap-1">
                        {getAmount(item.total)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {shouldShowMobileProductsToggle && (
                <button
                  className="mt-3 w-full px-4 py-2 text-sm font-medium text-[--primary-color]"
                  onClick={() => setShowAllProductsMobile(true)}
                  type="button"
                >
                  Ver más productos <span>({items.length - 5})</span>
                </button>
              )}
            </div>

            <div
              className="hidden max-h-[460px] flex-col gap-4 overflow-y-auto pr-1 md:flex"
              data-testid="products-table"
            >
              {items.map((item) => (
                <div
                  className="flex items-center gap-3 rounded-xl bg-ui-bg-subtle p-3"
                  data-testid="product-row"
                  key={item.id}
                >
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white">
                    <img
                      alt={item.product_title ?? ""}
                      className="h-full w-full object-cover"
                      onError={handleImageError}
                      src={item.thumbnail || PLACEHOLDER_IMAGE}
                    />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <p
                      className="truncate text-sm font-semibold text-ui-fg-base"
                      data-testid="product-name"
                    >
                      {item.product_title}
                    </p>
                    {item.variant?.title && (
                      <p className="truncate capitalize text-sm text-ui-fg-subtle">
                        {item.variant.title.toLowerCase()}
                      </p>
                    )}
                    <TintColorLabel
                      className="max-w-full text-sm text-ui-fg-subtle"
                      metadata={item.metadata}
                    />
                    <p className="mt-1 text-sm text-ui-fg-subtle">
                      Cantidad:{" "}
                      <span data-testid="product-quantity">{item.quantity}</span>
                    </p>
                  </div>
                  <div
                    className="shrink-0 self-end text-base font-semibold text-ui-fg-base"
                    data-testid="product-price"
                  >
                    {getAmount(item.total)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderDetailsTemplate;
