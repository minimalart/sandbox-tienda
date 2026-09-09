import type { Metadata } from "next";
import PendingClient from "./pending-client";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * SIN la marca en el título: la pone el `title.template` del root layout.
 *
 * Acá había `Pago Pendiente | ${tenant.name}` resuelto con `getTenant()`, el resolver ESTÁTICO
 * que devuelve siempre `defaultConfig` (`name: "Mercatto"`). En desdeelsur esto
 * emitía `<title>Pago Pendiente | Mercatto | Desde el sur</title>` en la pantalla que ve el
 * cliente JUSTO DESPUÉS DE PAGAR. Mismo patrón que ya se corrigió en
 * `checkout/page.tsx`; estas tres quedaron afuera.
 *
 * Metadata estática: no hace falta resolver el tenant para no nombrarlo.
 */
export const metadata: Metadata = {
  title: "Pago Pendiente",
  description: "Tu pago está siendo procesado",
}

/**
 * Retorno de MercadoPago con el pago sin acreditar (efectivo / en revisión).
 *
 * La página es SÓLO el overlay animado amarillo. Es una de las TRES pantallas
 * de retorno; la tarjeta blanca que estaba detrás se eliminó porque duplicaba
 * el mensaje del overlay con otro estilo.
 */
export default async function CheckoutPending() {
  return <PendingClient />;
}
