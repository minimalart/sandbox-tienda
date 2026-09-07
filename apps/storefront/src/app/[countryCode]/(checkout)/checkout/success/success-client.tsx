"use client";

import { useSiteHref } from "@lib/site-config/context";
import { useCartStore } from "@lib/stores";
import PaymentResultOverlay from "@modules/common/components/payment-result-overlay";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Post-MercadoPago landing page (verde).
 *
 * The browser return from MP is UX; the webhook is truth. We do NOT call
 * placeOrder here — that would defeat the whole point, because if the tab
 * dies the order never gets made.
 *
 * Instead we poll GET /api/store/orders/by-cart until the webhook finishes
 * creating the order on the backend, then redirect to /order/{id}/confirmed.
 *
 * La pantalla ES el overlay animado verde: es una de las TRES únicas pantallas
 * de retorno (verde / amarilla / roja). No hay tarjeta ni layout atrás — antes
 * había una tarjeta blanca genérica con "¡Pago Exitoso!" que además afirmaba
 * que el pago estaba listo antes de que el webhook hubiera creado la orden.
 *
 * El redirect lleva `celebrated=1` para que `/order/{id}/confirmed` NO vuelva a
 * reproducir la misma animación y su sonido dos segundos después.
 */
const POLL_INTERVAL_MS = 2000;
const POLL_MAX_ATTEMPTS = 30; // ~60s; webhook normally resolves in < 5s.

export default function CheckoutSuccessClient() {
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const siteHref = useSiteHref();
  const clearCart = useCartStore((s) => s.clearCart);

  useEffect(() => {
    const collectionStatus = searchParams.get("collection_status");
    const externalReference = searchParams.get("external_reference");
    const qs = searchParams.toString();

    // Non-approved statuses: pure UX routing.
    if (collectionStatus === "pending" || collectionStatus === "in_process") {
      router.replace(`${siteHref("/checkout/pending")}?${qs}`);
      return;
    }
    if (collectionStatus && collectionStatus !== "approved") {
      router.replace(`${siteHref("/checkout/failure")}?${qs}`);
      return;
    }

    // `mp_payment_pending` existe para que el botón "atrás" del browser desde
    // MercadoPago caiga en la pantalla roja en vez de en un checkout zombie
    // (ver `proxy.ts`). Llegar ACÁ ya es haber vuelto, y con el pago aprobado:
    // la cookie se apaga antes de cualquier otra cosa, y pase lo que pase con
    // el polling.
    //
    // Antes se limpiaba únicamente dentro del `if (result.order_id)`. Si el
    // webhook tardaba más que el polling, la cookie sobrevivía su hora entera y
    // el siguiente GET a /checkout redirigía a "Pago rechazado" sin que
    // hubiera ningún pago rechazado. Es el mecanismo del BUG-007 reportado en
    // QA, y su gatillo fue el BUG-001 de la misma sesión: un pago aprobado
    // cuya orden llegó 22 minutos tarde.
    document.cookie = "mp_payment_pending=; Path=/; Max-Age=0; SameSite=Lax";

    if (!externalReference) {
      setMessage(
        "No pudimos identificar tu carrito. Si ya pagaste, vas a recibir un correo electrónico cuando tu orden esté lista.",
      );
      return;
    }

    // Server-side cart cookie (_medusa_cart_id) is httpOnly; only the
    // backend can remove it. The webhook already converted the cart into
    // an order, so we have to tell the storefront API to drop its reference
    // — otherwise the user's next visit would resurrect a completed cart.
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
          router.replace(
            siteHref(`/order/${result.order_id}/confirmed?celebrated=1`)
          );
          return;
        }
      } catch {
        /* transient — just keep polling */
      }

      if (attempts >= POLL_MAX_ATTEMPTS) {
        setMessage(
          "Tu pago fue aprobado pero la confirmación está tardando. Te enviaremos un correo electrónico con el detalle de tu orden.",
        );
        return;
      }
      setTimeout(poll, POLL_INTERVAL_MS);
    };

    poll();

    return () => {
      cancelled = true;
    };
  }, [router, searchParams, clearCart, siteHref]);

  // Mientras se espera al webhook no hay orden a la que mandar al comprador:
  // el overlay muestra su spinner en vez del botón principal. La salida
  // secundaria, en cambio, está SIEMPRE: sin ella el comprador quedaba hasta
  // 60 segundos encerrado en una pantalla sin un solo control. Irse de acá no
  // cancela nada — la orden la crea el webhook, no esta pantalla — y el pago
  // ya está aprobado, así que el peor caso es que la vea en "Mis pedidos".
  return (
    <PaymentResultOverlay
      busy={!message}
      primary={
        message
          ? { label: "VER MIS PEDIDOS", kind: "link", href: "/account/orders" }
          : null
      }
      secondary={
        message
          ? { label: "Seguir comprando", href: "/" }
          : { label: "Ver mis pedidos", href: "/account/orders" }
      }
      subtitle={message ?? "Estamos confirmando tu pago…"}
      // Sin orden todavía, "¡Pedido confirmado!" prometería de más: el pago sí
      // está aprobado, la orden es lo que falta.
      title={message ? "¡Pago aprobado!" : undefined}
      variant="success"
    />
  );
}
