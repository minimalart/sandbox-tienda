import { getTenant } from "@lib/site-config/resolver";
import type { Metadata } from "next";
import CheckoutSuccessClient from "./success-client";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenant();

  return {
    title: `Pago Exitoso | ${tenant.name}`,
    description: "Tu pago fue procesado exitosamente",
  };
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
