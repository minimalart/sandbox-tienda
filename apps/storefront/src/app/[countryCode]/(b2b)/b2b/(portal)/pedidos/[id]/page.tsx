import { retrieveB2BOrder } from "@lib/data/b2b-cart";
import { getMyCompany } from "@lib/data/company";
import { retrieveCustomer } from "@lib/data/customer";
import B2BOrderDetail from "@modules/b2b/components/b2b-order-detail";
import PageHeader from "@modules/b2b/components/portal/page-header";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = { title: "Detalle del pedido | Mayorista" };

export default async function B2BOrderDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const [order, my, customer] = await Promise.all([
    retrieveB2BOrder(id),
    getMyCompany(),
    retrieveCustomer().catch(() => null),
  ]);

  if (!order) {
    notFound();
  }

  const company = { id: my.company?.id ?? "", name: my.company?.name ?? "" };
  const placedBy = { id: customer?.id ?? "", email: customer?.email ?? "" };

  return (
    <div className="space-y-5">
      <LocalizedClientLink
        href="/b2b/pedidos"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Volver a Pedidos
      </LocalizedClientLink>
      <PageHeader title={`Pedido #${order.display_id ?? order.id.slice(-6)}`} description="Detalle del pedido." />
      <B2BOrderDetail order={order} company={company} placedBy={placedBy} />
    </div>
  );
}
