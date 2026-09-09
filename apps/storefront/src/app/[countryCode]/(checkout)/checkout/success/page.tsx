import type { Metadata } from "next";
import CheckoutSuccessClient from "./success-client";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * SIN la marca en el título: la pone el `title.template` del root layout.
 *
 * Acá había `Pago Exitoso | ${tenant.name}` resuelto con `getTenant()`, el resolver ESTÁTICO
 * que devuelve siempre `defaultConfig` (`name: "Mercatto"`). En desdeelsur esto
 * emitía `<title>Pago Exitoso | Mercatto | Desde el sur</title>` en la pantalla que ve el
 * cliente JUSTO DESPUÉS DE PAGAR. Mismo patrón que ya se corrigió en
 * `checkout/page.tsx`; estas tres quedaron afuera.
 *
 * Metadata estática: no hace falta resolver el tenant para no nombrarlo.
 */
export const metadata: Metadata = {
  title: "Pago Exitoso",
  description: "Tu pago fue procesado exitosamente",
}

/**
 * Retorno del comprador desde MercadoPago (Checkout Pro y Checkout API).
 *
 * La página es SÓLO el cliente: es un paso de tránsito que espera al webhook y
 * redirige a `/order/{id}/confirmed`, que es la pantalla real de confirmación
 * (con la animación y el sonido). Antes acá se renderizaba además una tarjeta
 * blanca con "¡Pago Exitoso!" que no se parecía a esa pantalla ni a las de
 * pending/failure, y que encima afirmaba que el pago estaba listo antes de que
 * el webhook hubiera creado la orden.
 */
export default async function CheckoutSuccess() {
  return <CheckoutSuccessClient />;
}
