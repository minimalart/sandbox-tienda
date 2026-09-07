"use client";

import { useSiteHref } from "@lib/site-config/context";
import { useCartStore } from "@lib/stores";
import PaymentResultOverlay from "@modules/common/components/payment-result-overlay";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Pending page client (amarilla).
 *
 * Same principle as the success page: do NOT call placeOrder. The MP ticket
 * webhook will create the order in authorized state — we poll until it shows
 * up and then send the buyer to it.
 *
 * If the polling times out (webhook delay/failure), we fall back to a gentle
 * "we'll email you" message so the user doesn't see a blank page.
 *
 * Es una de las TRES únicas pantallas de retorno (verde / amarilla / roja): la
 * pantalla ES el overlay animado, sin tarjeta ni layout atrás.
 */
const POLL_INTERVAL_MS = 2500;
const POLL_MAX_ATTEMPTS = 40; // ~100s; ticket webhook normally resolves in < 10s.

export default function PendingClient() {
  const [orderId, setOrderId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const siteHref = useSiteHref();
  const clearCart = useCartStore((s) => s.clearCart);

  useEffect(() => {
    document.cookie = "mp_payment_pending=; Path=/; Max-Age=0; SameSite=Lax";

    const externalReference = searchParams.get("external_reference");
    if (!externalReference) {
      setMessage(
        "Tu pago está pendiente. Te enviaremos un correo electrónico cuando se acredite.",
      );
      return;
    }

    const clearServerCart = async () => {
      try {
        await fetch("/api/store/cart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "clearCart" }),
        });
      } catch {
        /* non-blocking */
      }
    };

    let cancelled = false;
    let attempts = 0;

    const poll = async () => {
      if (cancelled) return;
      attempts += 1;
      try {
        const response = await fetch(
          `/api/store/orders/by-cart?cart_id=${encodeURIComponent(externalReference)}`,
          { cache: "no-store" },
        );
        const result = (await response.json()) as { order_id: string | null };
        if (cancelled) return;

        if (result.order_id) {
          clearCart();
          await clearServerCart();
          setOrderId(result.order_id);
          // El detalle de la orden ya trae su propio aviso de pago pendiente;
          // `celebrated=1` evita que reproduzca esta misma animación de nuevo.
          router.replace(
            siteHref(`/order/${result.order_id}/confirmed?celebrated=1`),
          );
          return;
        }
      } catch {
        /* transient — keep polling */
      }

      if (attempts >= POLL_MAX_ATTEMPTS) {
        setMessage(
          "Tu pago está pendiente. Te enviaremos un correo electrónico cuando se acredite.",
        );
        return;
      }
      setTimeout(poll, POLL_INTERVAL_MS);
    };

    poll();

    return () => {
      cancelled = true;
    };
  }, [searchParams, clearCart, router, siteHref]);

  const settled = Boolean(orderId || message);

  // El spinner ocupa la pantalla completa mientras se espera al webhook, pero
  // la salida secundaria queda SIEMPRE disponible. Antes `secondary` era null
  // hasta que el polling se resolvía: con el webhook lento, el comprador
  // quedaba hasta 100 segundos en una pantalla sin un solo control, sin poder
  // volver al sitio (QA lo reportó como "queda cargando y no permite continuar
  // con la navegación"). Irse no cancela nada: la orden la crea el webhook,
  // no esta pantalla.
  return (
    <PaymentResultOverlay
      busy={!settled}
      primary={
        orderId
          ? {
              label: "VER MI PEDIDO",
              kind: "link",
              href: `/order/${orderId}/confirmed?celebrated=1`,
            }
          : message
            ? { label: "VER MIS PEDIDOS", kind: "link", href: "/account/orders" }
            : null
      }
      secondary={{ label: "Seguir comprando", href: "/" }}
      subtitle={message ?? undefined}
      variant="pending"
    />
  );
}
