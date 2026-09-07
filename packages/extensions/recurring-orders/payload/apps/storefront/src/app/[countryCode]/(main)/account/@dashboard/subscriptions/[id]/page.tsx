import { retrieveCustomer } from "@lib/data/customer";
import { retrieveRecurringOrder } from "@lib/data/recurring-orders";
import SubscriptionDetail from "@modules/account/components/subscriptions/subscription-detail";
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
