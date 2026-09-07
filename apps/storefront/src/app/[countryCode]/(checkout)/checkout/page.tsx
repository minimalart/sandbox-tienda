import { retrieveCustomer } from "@lib/data/customer";
import { getActiveDemoSalesChannelId } from "@lib/site-config/active-tenant";
import type { Metadata } from "next";
import CheckoutPageClient from "./checkout-page-client";

// Forzar renderizado dinámico para evitar caché
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * SIN la marca en el título: la pone el `title.template` del root layout.
 *
 * Acá había `Finalizar compra | ${tenant.name}` resuelto con `getTenant()` — el
 * resolver ESTÁTICO de `site-config/resolver.ts`, que devuelve siempre
 * `defaultConfig` (`name: "Mercatto"`) y no fetchea la fila del sitio. El resultado en
 * desdeelsur era `<title>Finalizar compra | Mercatto | Desde el sur</title>`: la marca
 * ajena la ponía esta línea y la propia el template del layout.
 *
 * El arreglo no es cambiar a `getActiveTenant()`, que dejaría `Finalizar compra |
 * Desde el sur | Desde el sur`. Es no nombrar la marca acá, igual que `/cart` — que
 * por eso emitía `Carrito | Desde el sur` bien.
 */
export const metadata: Metadata = {
  title: "Finalizar compra",
  description:
    "Completá tu compra de forma segura. Ingresá tus datos de envío y pago.",
};

export default async function Checkout() {
  const [customer, demoSalesChannelId] = await Promise.all([
    retrieveCustomer(),
    // Canal del demo activo (header x-demo-slug reinyectado por el proxy). El
    // checkout vive en su propio route group sin ChannelProvider del demo, así
    // que lo resolvemos acá para que el cross-sell no traiga otro sales channel.
    getActiveDemoSalesChannelId(),
  ]);
  const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY ?? "";
  return (
    <CheckoutPageClient
      googleMapsApiKey={googleMapsApiKey}
      initialCustomer={customer}
      demoSalesChannelId={demoSalesChannelId}
    />
  );
}
