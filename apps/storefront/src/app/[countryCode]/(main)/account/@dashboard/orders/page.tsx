import { retrieveCustomer } from "@lib/data/customer";
import { listOrders } from "@lib/data/orders";
import Overview from "@modules/account/components/overview";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  title: "Mis pedidos",
  description: "Consultá tus pedidos y seguí el estado de cada compra.",
};

export default async function Orders() {
  const [customer, orders] = await Promise.all([
    retrieveCustomer().catch(() => null),
    listOrders().catch(() => null),
  ]);

  if (!customer) {
    notFound();
  }

  return (
    <div className="space-y-6" data-testid="orders-page-wrapper">
      <div>
        <h2 className="font-semibold text-base/7 text-gray-900">
          Mis pedidos
        </h2>
        <p className="mt-1 text-gray-500 text-sm/6">
          Consultá el estado de tus compras y accedé al detalle de cada pedido.
        </p>
      </div>
      <Overview customer={customer} orders={orders} />
    </div>
  );
}
