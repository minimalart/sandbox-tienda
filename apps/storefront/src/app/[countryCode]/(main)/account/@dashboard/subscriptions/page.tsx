import { retrieveCustomer } from "@lib/data/customer";
import { listMyRecurringOrders } from "@lib/data/recurring-orders";
import { getRecurringEnabled } from "@lib/site-config/active-tenant";
import SubscriptionsList from "@modules/account/components/subscriptions/subscriptions-list";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  title: "Compras recurrentes",
  description: "Gestioná tus suscripciones de reposición automática.",
};

export default async function SubscriptionsPage() {
  // Esconder el link del nav no alcanzaba: con la feature apagada esta URL seguía
  // respondiendo 200 y listando las suscripciones del cliente. El flag es opt-in
  // (`getRecurringEnabled` ya coerciona), así que un fallo de lectura cierra la
  // puerta — al revés que loyalty/gift-cards, que son opt-out y fallan abiertas.
  if (!(await getRecurringEnabled().catch(() => false))) {
    notFound();
  }

  const customer = await retrieveCustomer().catch(() => null);
  if (!customer) {
    notFound();
  }

  const { recurring_orders } = await listMyRecurringOrders({ limit: 50 });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-semibold text-base/7 text-gray-900">
          Compras recurrentes
        </h2>
        <p className="mt-1 text-gray-500 text-sm/6">
          Tus suscripciones de reposición: antes de cada entrega te mandamos un
          link para confirmar y pagar.
        </p>
      </div>
      <SubscriptionsList recurringOrders={recurring_orders} />
    </div>
  );
}
