import { retrieveCustomer } from "@lib/data/customer";
import { listClaimableOrders, listOrders } from "@lib/data/orders";
import ClaimableOrders from "@modules/account/components/claimable-orders";
import Overview from "@modules/account/components/overview";
import TransferRequestForm from "@modules/account/components/transfer-request-form";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  title: "Mis pedidos",
  description: "Consultá tus pedidos y seguí el estado de cada compra.",
};

export default async function Orders() {
  // Las órdenes reclamables van en la misma tanda: es una consulta chica y, si
  // falla, `listClaimableOrders` ya devuelve [] sin tirar abajo el listado.
  const [customer, orders, claimableOrders] = await Promise.all([
    retrieveCustomer().catch(() => null),
    listOrders().catch(() => null),
    listClaimableOrders(),
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

      {/* Va ARRIBA del listado: es la respuesta a "compré y no aparece", que es
          justo el motivo por el que alguien entra a esta pantalla. Sin órdenes
          reclamables el bloque no renderiza nada. */}
      <ClaimableOrders orders={claimableOrders} />

      <Overview customer={customer} orders={orders} />

      {/* Salida manual para lo que la detección automática no alcanza: una
          compra hecha con OTRO email (el cliente puso el del trabajo, o hubo un
          typo). Estaba escrito y sin montar en ninguna página. */}
      <TransferRequestForm />
    </div>
  );
}
