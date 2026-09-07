"use client";

import { transferCart } from "@lib/data/customer";
import { shouldTransferCartToCustomer } from "@lib/util/cart-customer-transfer";
import { ExclamationCircleSolid } from "@medusajs/icons";
import type { StoreCart, StoreCustomer } from "@medusajs/types";
import { Button } from "@medusajs/ui";
import { useState } from "react";

function CartMismatchBanner(props: {
  customer: StoreCustomer;
  cart: StoreCart;
}) {
  const { customer, cart } = props;
  const [isPending, setIsPending] = useState(false);
  const [actionText, setActionText] = useState("Reintentar transferencia");

  // No alcanza con mirar `cart.customer_id`: un carrito puede tener customer_id
  // de un INVITADO (Medusa lo crea solo al guardar el email en el paso de
  // direcciones) y ése es justo el caso que hay que ofrecer transferir — el core
  // permite el transfer de un carrito de invitado a la cuenta.
  // Ver @lib/util/cart-customer-transfer.
  if (!customer || !shouldTransferCartToCustomer(cart)) {
    return;
  }

  const handleSubmit = async () => {
    try {
      setIsPending(true);
      setActionText("Transfiriendo..");

      await transferCart();
    } catch {
      setActionText("Reintentar transferencia");
      setIsPending(false);
    }
  };

  return (
    <div className="mt-2 flex items-center justify-center gap-1 bg-orange-300 p-2 text-center text-orange-800 text-sm small:gap-2 small:p-4">
      <div className="flex flex-col items-center gap-1 small:flex-row small:gap-2">
        <span className="flex items-center gap-1">
          <ExclamationCircleSolid className="inline" />
          Algo salió mal al intentar transferir tu carrito
        </span>

        <span>·</span>

        <Button
          className="bg-transparent p-0 text-orange-950 hover:bg-transparent focus:bg-transparent active:bg-transparent disabled:text-orange-500"
          disabled={isPending}
          onClick={handleSubmit}
          size="base"
          variant="transparent"
        >
          {actionText}
        </Button>
      </div>
    </div>
  );
}

export default CartMismatchBanner;
