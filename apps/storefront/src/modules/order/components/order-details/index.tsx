import { formatDateAR } from "@lib/util/format-date";
import type { HttpTypes } from "@medusajs/types";
import { Text } from "@medusajs/ui";

type OrderDetailsProps = {
  order: HttpTypes.StoreOrder;
  pendingPayment?: boolean;
};

const OrderDetails = ({ order, pendingPayment = false }: OrderDetailsProps) => {
  const orderDate =
    formatDateAR(order.created_at, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }) ?? "";

  const capitalizedDate = orderDate.charAt(0).toUpperCase() + orderDate.slice(1);

  return (
    <div className="flex w-full flex-col items-center">
      <Text className="max-w-2xl text-center text-base text-ui-fg-subtle">
        {pendingPayment
          ? "Vamos a procesar el pedido cuando se confirme el pago. Te enviaremos un correo con los detalles."
          : "Hemos procesado tu pedido correctamente. Te enviaremos un correo con los detalles."}
      </Text>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <span
          className="rounded-full border border-ui-border-base px-4 py-1.5 text-sm font-[500] text-[--tertiary-color]"
          data-testid="order-id"
        >
          Orden #{order.custom_display_id ?? order.display_id}
        </span>
        <span
          className="rounded-full border border-ui-border-base px-4 py-1.5 text-sm font-[500] text-[--tertiary-color]"
          data-testid="order-date"
        >
          {capitalizedDate}
        </span>
      </div>
    </div>
  );
};

export default OrderDetails;
