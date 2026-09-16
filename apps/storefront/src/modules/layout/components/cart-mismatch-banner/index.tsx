"use client";

import { transferCart } from "@lib/data/customer";
import { shouldTransferCartToCustomer } from "@lib/util/cart-customer-transfer";
import { ExclamationCircleSolid } from "@medusajs/icons";
import type { StoreCart, StoreCustomer } from "@medusajs/types";
import { Button } from "@medusajs/ui";
import { useState } from "react";

/**
 * Aviso de carrito colgado de un invitado, con la acción para pasarlo a la cuenta.
 *
 * ── EL TEXTO DESCRIBE EL ESTADO, NO UN FALLO ────────────────────────────────
 *
 * Antes decía "Algo salió mal al intentar transferir tu carrito" apenas se montaba.
 * Pero la condición que lo monta —`shouldTransferCartToCustomer`— no es un error: es
 * el estado NORMAL de quien cargó el carrito sin loguearse y después inició sesión.
 * Nadie intentó ninguna transferencia todavía, así que nada pudo salir mal.
 *
 * En producción eso daba un aviso rojo de error mientras el carrito se veía completo
 * en el header y al abrirlo — QA lo reportó como "falso error" con razón, porque el
 * mensaje decía que algo había fallado cuando no había fallado nada
 * (DESDEELSUR-61, BUG-16).
 *
 * Peor que el ruido: el aviso quemaba la señal. Cuando el transfer SÍ falle, el
 * usuario ya vio mil veces ese mismo cartel sin consecuencias y no le va a dar bola.
 * Por eso el texto de error ahora aparece SÓLO después de un fallo real.
 */
function CartMismatchBanner(props: {
  customer: StoreCustomer;
  cart: StoreCart;
}) {
  const { customer, cart } = props;
  const [isPending, setIsPending] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);

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
      setHasFailed(false);

      await transferCart();
    } catch {
      setHasFailed(true);
      setIsPending(false);
    }
  };

  const message = hasFailed
    ? "No pudimos pasar tu carrito a tu cuenta"
    : "Tenés productos en un carrito de invitado";

  const actionText = isPending
    ? "Pasando a tu cuenta.."
    : hasFailed
      ? "Reintentar"
      : "Sumarlos a mi cuenta";

  return (
    <div className="mt-2 flex items-center justify-center gap-1 bg-orange-300 p-2 text-center text-orange-800 text-sm small:gap-2 small:p-4">
      <div className="flex flex-col items-center gap-1 small:flex-row small:gap-2">
        <span className="flex items-center gap-1">
          <ExclamationCircleSolid className="inline" />
          {message}
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
