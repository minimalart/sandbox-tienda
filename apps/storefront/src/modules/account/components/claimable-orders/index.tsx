"use client";

import type { ClaimableOrder } from "@lib/data/orders";
import { createTransferRequest } from "@lib/data/orders";
import { convertToLocale } from "@lib/util/money";
import { CheckCircleMiniSolid } from "@medusajs/icons";
import { SubmitButton } from "@modules/checkout/components/submit-button";
import { useActionState } from "react";

/**
 * "Encontramos pedidos a tu nombre": las compras hechas como invitado con el
 * email de esta cuenta.
 *
 * EL BUG (DESDEELSUR-61 / BUG-07). Comprar como invitado con un email que ya
 * tiene cuenta deja la orden colgada de un customer invitado con id propio, y
 * `GET /store/orders` filtra por `customer_id` — la compra no aparecía nunca en
 * "Mis pedidos", por más veces que la persona iniciara sesión.
 *
 * Medusa ya traía la solución y el storefront ya la tenía cableada: el flujo de
 * transfer (`createTransferRequest`) manda la confirmación al email DE LA ORDEN
 * y exige el click, así que nadie se apropia de un pedido ajeno. Lo que faltaba
 * era descubribilidad: el único formulario que existía (`TransferRequestForm`)
 * no estaba montado en ninguna página y, aunque lo estuviera, pedía el
 * `order_id` de memoria — de una compra que la persona nunca vio en su cuenta.
 *
 * Este bloque cierra esa brecha: el backend detecta las órdenes reclamables
 * (`GET /store/customers/me/claimable-orders`, con los candados de email y de
 * `has_account`) y acá sólo hay que apretar un botón. La adjudicación sigue
 * siendo la de Medusa, verificada por mail.
 *
 * Cada fila maneja su propio estado a propósito: subir el "ya la reclamé" al
 * padre obligaría a un efecto de sincronización por fila, y de eso no se saca
 * nada — las solicitudes son independientes entre sí.
 */
export default function ClaimableOrders({
  orders,
}: {
  orders: ClaimableOrder[];
}) {
  if (orders.length === 0) return null;

  const isPlural = orders.length > 1;

  return (
    <div
      className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50 p-6"
      data-testid="claimable-orders"
    >
      <div>
        <h3 className="font-semibold text-amber-900 text-base/7">
          Encontramos {isPlural ? "pedidos" : "un pedido"} a tu nombre
        </h3>
        <p className="mt-1 text-amber-800 text-sm/6">
          {isPlural ? "Estas compras se hicieron" : "Esta compra se hizo"} con tu
          email sin haber iniciado sesión, así que todavía no{" "}
          {isPlural ? "figuran" : "figura"} en tu cuenta. Al vincular{" "}
          {isPlural ? "cada pedido" : "el pedido"} te enviamos un mail para
          confirmar que {isPlural ? "son tuyos" : "es tuyo"}.
        </p>
      </div>

      <ul className="space-y-3">
        {orders.map((order) => (
          <ClaimableOrderRow key={order.id} order={order} />
        ))}
      </ul>
    </div>
  );
}

function ClaimableOrderRow({ order }: { order: ClaimableOrder }) {
  const [state, formAction] = useActionState(createTransferRequest, {
    success: false,
    error: null,
    order: null,
  });

  const label = order.display_id ? `#${order.display_id}` : order.id;
  const meta = [formatDate(order.created_at), formatTotal(order)]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-medium text-gray-900 text-sm">Pedido {label}</p>
        {meta && <p className="text-gray-500 text-sm">{meta}</p>}
      </div>

      {state.success ? (
        <div
          className="flex items-start gap-2 rounded-lg bg-green-50 p-3 text-green-900 text-sm sm:max-w-xs"
          data-testid="claim-order-sent"
        >
          <CheckCircleMiniSolid className="h-5 w-5 shrink-0 text-green-600" />
          <p>
            Te mandamos un mail: confirmá el enlace y el pedido aparece acá.
          </p>
        </div>
      ) : (
        <form action={formAction}>
          {/* El id viaja oculto: `createTransferRequest` lo lee del FormData,
              así que este bloque reusa el mismo server action que el formulario
              manual sin duplicar la llamada al SDK. */}
          <input name="order_id" type="hidden" value={order.id} />
          <SubmitButton
            className="inline-flex w-full justify-center rounded-md bg-[--primary-color] px-4 py-2 font-semibold text-sm text-white shadow-none hover:opacity-90 sm:w-auto"
            data-testid="claim-order-button"
          >
            Vincular a mi cuenta
          </SubmitButton>
          {state.error && (
            <p className="mt-2 font-medium text-rose-500 text-sm">
              {state.error}
            </p>
          )}
        </form>
      )}
    </li>
  );
}

function formatDate(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatTotal(order: ClaimableOrder): string {
  if (typeof order.total !== "number") return "";
  return convertToLocale({
    amount: order.total,
    currency_code: order.currency_code || "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    locale: "es-AR",
  });
}
