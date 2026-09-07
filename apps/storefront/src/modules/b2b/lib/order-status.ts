export type OrderStatusBadge = { label: string; className: string };

/**
 * Mapea estado/pago/fulfillment de una orden a una etiqueta legible + clases del
 * portal (border/bg/text, compatibles con dark mode). Misma lógica que el detalle
 * del B2C pero con tokens del portal. Acepta strings sueltos para no depender del
 * union exacto de fulfillment_status del SDK.
 */
export function getB2BOrderStatus(
  order: {
    status?: string | null;
    payment_status?: string | null;
    fulfillment_status?: string | null;
  },
): OrderStatusBadge {
  const status = order.status ?? "";
  const fs = order.fulfillment_status ?? "";
  const ps = order.payment_status ?? "";

  if (status === "canceled" || fs === "canceled") {
    return { label: "Cancelado", className: "border-red-200 bg-red-50 text-red-700" };
  }
  const paymentDone = ps === "captured" || ps === "refunded";
  if (!paymentDone) {
    return { label: "Pago pendiente", className: "border-amber-200 bg-amber-50 text-amber-700" };
  }
  if (fs === "delivered") {
    return { label: "Entregado", className: "border-green-200 bg-green-50 text-green-700" };
  }
  if (fs === "shipped" || fs === "partially_shipped") {
    return { label: "Enviado", className: "border-blue-200 bg-blue-50 text-blue-700" };
  }
  if (fs === "fulfilled" || fs === "partially_fulfilled") {
    return { label: "En preparación", className: "border-blue-200 bg-blue-50 text-blue-700" };
  }
  if (fs === "returned" || fs === "partially_returned") {
    return { label: "Devuelto", className: "border-orange-200 bg-orange-50 text-orange-700" };
  }
  if (status === "completed") {
    return { label: "Completado", className: "border-green-200 bg-green-50 text-green-700" };
  }
  return { label: "Pendiente", className: "border-border bg-muted text-muted-foreground" };
}
