import { getTenant } from "@lib/site-config/resolver";
import type { Metadata } from "next";
import PendingClient from "./pending-client";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenant();

  return {
    title: `Pago Pendiente | ${tenant.name}`,
    description: "Tu pago está siendo procesado",
  };
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
