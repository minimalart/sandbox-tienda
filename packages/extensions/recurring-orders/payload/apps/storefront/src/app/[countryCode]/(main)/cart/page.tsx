import { retrieveCart } from "@lib/data/cart";
import {
  getRecurringEligibilityDetail,
  getSubscriptionPlans,
} from "@lib/data/recurring-orders";
import { retrieveCustomer } from "@lib/data/customer";
import { getRecurringEnabled } from "@lib/site-config/active-tenant";
import { getTenant } from "@lib/site-config/resolver";
import CartTemplate from "@modules/cart/templates";
import type { Metadata } from "next";
import CartPageClient from "./cart-page-client";

// Forzar renderizado dinámico para evitar caché y obtener siempre el estado actual del carrito
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenant();

  return {
    title: 'Carrito',
    /**
     * `noindex`: página de sesión/utilidad, no un resultado de búsqueda.
     *
     * El `robots.txt` ya la bloquea, pero una URL bloqueada que Google descubre por un
     * link se puede indexar SIN contenido ("indexada aunque bloqueada"). El meta es lo
     * que lo evita. La auditoría del 19/08 no encontró NINGUNA página noindex en todo
     * el storefront: /account y /lista-de-compras se crawlearon y midieron.
     */
    robots: { index: false, follow: false },
    description: "Revisá los productos en tu carrito de compras y continuá con el checkout.",
  };
}

export default async function Cart() {
  // Intentar obtener el carrito desde el servidor (cart y customer son independientes)
  const [cart, customer, recurringEnabled] = await Promise.all([
    retrieveCart(),
    retrieveCustomer(),
    getRecurringEnabled().catch(() => false),
  ]);

  // Si no hay cart en el servidor, usar el componente cliente que obtiene el carrito desde la API
  // Esto resuelve el problema de que la cookie no esté disponible en el servidor
  if (!cart) {
    return <CartPageClient initialCustomer={customer} />;
  }

  // Elegibilidad por producto (scope all/selected del canal): "Convertir en
  // compra recurrente" solo ofrece las líneas elegibles; los descuentos por
  // frecuencia se muestran como ahorro estimado.
  const eligibility = recurringEnabled
    ? await getRecurringEligibilityDetail(
        (cart.items ?? []).map((i) => i.product_id ?? "").filter(Boolean),
      )
    : { eligible: [], discounts: {} };
  const productIds = (cart.items ?? [])
    .map((item) => item.product_id ?? "")
    .filter(Boolean);
  const variantIds = (cart.items ?? [])
    .map((item) => item.variant_id ?? "")
    .filter(Boolean);
  const planResult = recurringEnabled
    ? await getSubscriptionPlans({ productIds, variantIds })
    : { plans: [], automatic_payments_enabled: false };
  const hasCommonPlan = planResult.plans.some((plan) =>
    productIds.every((productId) => plan.eligible_product_ids.includes(productId)),
  );
  const allLegacyEligible =
    productIds.length > 0 &&
    productIds.every((productId) => eligibility.eligible.includes(productId));

  return (
    <CartTemplate
      cart={cart}
      customer={customer}
      recurringEnabled={recurringEnabled && (hasCommonPlan || allLegacyEligible)}
      recurringEligibleProductIds={eligibility.eligible}
      recurringDiscounts={eligibility.discounts}
      subscriptionPlans={planResult.plans}
      automaticPaymentsEnabled={planResult.automatic_payments_enabled}
    />
  );
}
