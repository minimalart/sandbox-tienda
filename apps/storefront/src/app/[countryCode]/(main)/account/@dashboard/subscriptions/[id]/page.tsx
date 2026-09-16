import { retrieveCustomer } from "@lib/data/customer";
import { retrieveRecurringOrder } from "@lib/data/recurring-orders";
import SubscriptionDetail from "@modules/account/components/subscriptions/subscription-detail";
import { getRecurringEnabled } from "@lib/site-config/active-tenant";
import { getTenant } from "@lib/site-config/resolver";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  title: "Compra recurrente",
  description: "Detalle de tu suscripción de reposición.",
};

export default async function SubscriptionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Mismo gate que el listado: sin esto la tienda que apaga la feature deja
  // accesible el detalle de cada suscripción por URL directa.
  if (!(await getRecurringEnabled().catch(() => false))) {
    notFound();
  }

  const customer = await retrieveCustomer().catch(() => null);
  if (!customer) {
    notFound();
  }

  const [recurringOrder, tenant] = await Promise.all([
    retrieveRecurringOrder(id),
    getTenant(),
  ]);
  if (!recurringOrder) {
    notFound();
  }

  return (
    <SubscriptionDetail
      mercadoPagoPublicKey={tenant.assets?.mercadopago?.publicKey ?? null}
      recurringOrder={recurringOrder}
    />
  );
}
