"use client";

import { CheckCircleIcon, XCircleIcon, ExclamationCircleIcon } from "@heroicons/react/24/solid";
import { sdk } from "@lib/config";
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

// ============================================================================
// TIPOS
// ============================================================================

type ValidationStatus =
  | "idle"
  | "loading"
  | "success"
  | "invalid_pin"
  | "already_delivered"
  | "cde_mismatch"
  | "no_cde_selected"
  | "fulfillment_not_ready"
  | "delivery_failed"
  | "payment_pending"
  | "error";

interface OrderSummary {
  customerName: string;
  total: number;
  currencyCode: string;
  itemCount: number;
}

// ============================================================================
// HELPERS
// ============================================================================

const BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000";
const PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "";

async function fetchOrderSummary(orderId: string): Promise<OrderSummary | null> {
  try {
    const { order } = await sdk.store.order.retrieve(orderId, { fields: "+metadata" });
    if (!order) return null;
    return {
      customerName:
        [order.shipping_address?.first_name, order.shipping_address?.last_name]
          .filter(Boolean)
          .join(" ") ||
        order.email ||
        "—",
      total: order.total ?? 0,
      currencyCode: order.currency_code ?? "ars",
      itemCount: order.items?.length ?? 0,
    };
  } catch {
    return null;
  }
}

async function validatePickup(
  orderId: string,
  storeLocationId: string,
  deliveryPin: number,
): Promise<{ status: ValidationStatus }> {
  try {
    const res = await fetch(
      `${BACKEND_URL}/store/orders/${orderId}/validate-pickup`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-publishable-api-key": PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          store_location_id: storeLocationId,
          delivery_pin: deliveryPin,
        }),
        cache: "no-store",
      },
    );

    if (res.ok) return { status: "success" };

    const data = await res.json().catch(() => ({}));
    const code: string = data?.code || data?.type || "";

    if (res.status === 401 || code === "invalid_pin") return { status: "invalid_pin" };
    if (res.status === 409 || code === "already_delivered") return { status: "already_delivered" };
    if (code === "cde_mismatch") return { status: "cde_mismatch" };
    if (code === "no_cde_selected") return { status: "no_cde_selected" };
    if (res.status === 503 || code === "fulfillment_not_ready") return { status: "fulfillment_not_ready" };
    if (code === "delivery_failed") return { status: "delivery_failed" };
    if (res.status === 402 || code === "payment_pending") return { status: "payment_pending" };

    return { status: "error" };
  } catch {
    return { status: "error" };
  }
}

function formatAmount(amount: number, currencyCode: string) {
  try {
    return new Intl.NumberFormat("es-AR", {
      style: "decimal",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      useGrouping: true,
    }).format(amount);
  } catch {
    return `${currencyCode.toUpperCase()} ${amount}`;
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function ValidarEntregaPage() {
  const params = useParams();
  const searchParams = useSearchParams();

  const orderId = Array.isArray(params?.orderId)
    ? params.orderId[0]
    : (params?.orderId as string) || "";
  const cdeId = searchParams.get("cde_id") || "";

  const [pin, setPin] = useState("");
  const [status, setStatus] = useState<ValidationStatus>("idle");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSummary, setOrderSummary] = useState<OrderSummary | null>(null);

  useEffect(() => {
    if (orderId) {
      fetchOrderSummary(orderId).then(setOrderSummary);
    }
  }, [orderId]);

  const handleSubmit = useCallback(async () => {
    const pinNumber = Number.parseInt(pin, 10);
    if (!pin || Number.isNaN(pinNumber)) return;
    if (!cdeId) {
      setStatus("cde_mismatch");
      return;
    }

    setIsSubmitting(true);
    setStatus("loading");
    const result = await validatePickup(orderId, cdeId, pinNumber);
    setStatus(result.status);
    setIsSubmitting(false);

    if (result.status === "invalid_pin") {
      setPin("");
    }
  }, [pin, orderId, cdeId]);

  const handleReset = () => {
    setPin("");
    setStatus("idle");
  };

  // ── Missing params guard ────────────────────────────
  if (!orderId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
          <ExclamationCircleIcon className="mx-auto mb-4 h-12 w-12 text-amber-400" />
          <p className="font-semibold text-gray-800">QR inválido</p>
          <p className="mt-1 text-gray-500 text-sm">
            Este código QR no contiene información de pedido válida.
          </p>
        </div>
      </div>
    );
  }

  // ── Success state ────────────────────────────────────
  if (status === "success") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-sm">
          <CheckCircleIcon className="mx-auto mb-4 h-16 w-16 text-green-500" />
          <h1 className="font-bold text-gray-900 text-xl">Entrega confirmada</h1>
          <p className="mt-2 text-gray-600 text-sm">
            El pedido{" "}
            <span className="font-medium text-gray-800">
              #{orderId.slice(-8).toUpperCase()}
            </span>{" "}
            fue entregado exitosamente.
          </p>
          {orderSummary && (
            <p className="mt-1 text-gray-500 text-sm">{orderSummary.customerName}</p>
          )}
        </div>
      </div>
    );
  }

  // ── Already delivered state ──────────────────────────
  if (status === "already_delivered") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-sm">
          <ExclamationCircleIcon className="mx-auto mb-4 h-16 w-16 text-amber-400" />
          <h1 className="font-bold text-gray-900 text-xl">Pedido ya entregado</h1>
          <p className="mt-2 text-gray-500 text-sm">
            Este pedido ya fue registrado como entregado anteriormente.
          </p>
          <button
            className="mt-6 rounded-lg bg-gray-100 px-6 py-2 text-gray-700 text-sm hover:bg-gray-200"
            onClick={handleReset}
            type="button"
          >
            Volver
          </button>
        </div>
      </div>
    );
  }

  // ── Payment pending — block delivery ─────────────────
  if (status === "payment_pending") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-sm">
          <XCircleIcon className="mx-auto mb-4 h-16 w-16 text-red-400" />
          <h1 className="font-bold text-gray-900 text-xl">Pago pendiente</h1>
          <p className="mt-2 text-gray-500 text-sm">
            Este pedido todavía no fue cobrado. No se puede entregar el kit hasta que se confirme el pago.
          </p>
          <p className="mt-2 text-gray-400 text-xs">
            Verificá el estado del pedido antes de hacer la entrega.
          </p>
        </div>
      </div>
    );
  }

  // ── Fulfillment not ready / delivery failed ──────────
  if (status === "fulfillment_not_ready" || status === "delivery_failed") {
    const isNotReady = status === "fulfillment_not_ready";
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-sm">
          <ExclamationCircleIcon className="mx-auto mb-4 h-16 w-16 text-amber-400" />
          <h1 className="font-bold text-gray-900 text-xl">
            {isNotReady ? "Pedido aún no listo" : "No se pudo confirmar la entrega"}
          </h1>
          <p className="mt-2 text-gray-500 text-sm">
            {isNotReady
              ? "El pedido todavía se está procesando. Esperá unos segundos y volvé a intentar."
              : "Ocurrió un error al marcar el pedido como entregado. Volvé a intentarlo."}
          </p>
          <button
            className="mt-6 rounded-lg bg-gray-100 px-6 py-2 text-gray-700 text-sm hover:bg-gray-200"
            onClick={handleReset}
            type="button"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  // ── CDE mismatch / no CDE state ──────────────────────
  if (status === "cde_mismatch" || status === "no_cde_selected") {
    const msg =
      status === "cde_mismatch"
        ? "Este QR no corresponde a este centro de distribución."
        : "Esta orden no tiene configurado el retiro por CDE.";
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-sm">
          <XCircleIcon className="mx-auto mb-4 h-16 w-16 text-red-400" />
          <h1 className="font-bold text-gray-900 text-xl">No se puede validar</h1>
          <p className="mt-2 text-gray-500 text-sm">{msg}</p>
          <button
            className="mt-6 rounded-lg bg-gray-100 px-6 py-2 text-gray-700 text-sm hover:bg-gray-200"
            onClick={handleReset}
            type="button"
          >
            Volver
          </button>
        </div>
      </div>
    );
  }

  // ── Main form ────────────────────────────────────────
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="mb-6 text-center">
          <h1 className="font-bold text-gray-900 text-2xl">Validar entrega</h1>
          <p className="mt-1 text-gray-500 text-sm">
            Pedido #{orderId.slice(-8).toUpperCase()}
          </p>
        </div>

        {/* Order summary card */}
        {orderSummary && (
          <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="font-semibold text-gray-900">{orderSummary.customerName}</p>
            <div className="mt-2 flex items-center justify-between text-gray-500 text-sm">
              <span>
                {orderSummary.itemCount}{" "}
                {orderSummary.itemCount === 1 ? "producto" : "productos"}
              </span>
              <span className="font-medium text-gray-700">
                {"$ "}{formatAmount(orderSummary.total, orderSummary.currencyCode)}
              </span>
            </div>
          </div>
        )}

        {/* PIN form */}
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <label
            className="mb-2 block font-medium text-gray-700 text-sm"
            htmlFor="pin-input"
          >
            Ingresá el PIN de entrega
          </label>

          <input
            autoComplete="one-time-code"
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-center font-mono text-2xl tracking-widest focus:border-[--primary-color] focus:outline-none focus:ring-2 focus:ring-[--primary-color]/20"
            id="pin-input"
            inputMode="numeric"
            maxLength={8}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, "");
              setPin(val);
              if (status === "invalid_pin" || status === "error") {
                setStatus("idle");
              }
            }}
            pattern="[0-9]*"
            placeholder="····"
            type="text"
            value={pin}
          />

          {/* Error messages */}
          {status === "invalid_pin" && (
            <p className="mt-2 flex items-center gap-1 text-red-600 text-sm">
              <XCircleIcon className="h-4 w-4 flex-shrink-0" />
              PIN incorrecto, intentá de nuevo.
            </p>
          )}
          {status === "error" && (
            <p className="mt-2 text-gray-500 text-sm">
              Error de conexión. Verificá tu red e intentá de nuevo.
            </p>
          )}

          <button
            className="mt-4 w-full rounded-xl bg-[--primary-color] py-3 font-semibold text-base text-white shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!pin || isSubmitting}
            onClick={handleSubmit}
            type="button"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
                Validando...
              </span>
            ) : (
              "Confirmar entrega"
            )}
          </button>
        </div>

        {!cdeId && (
          <p className="mt-4 text-center text-gray-400 text-xs">
            El QR no incluye el ID del centro (<code>?cde_id=</code>). La validación será rechazada por el servidor.
          </p>
        )}
      </div>
    </div>
  );
}
