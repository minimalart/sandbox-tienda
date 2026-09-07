import { getMyCompany } from "@lib/data/company";
import { retrieveCustomer } from "@lib/data/customer";
import { getActiveDemoB2B } from "@lib/site-config/active-tenant";
import B2BOrderBuilder from "@modules/b2b/components/b2b-order-builder";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Nuevo pedido | Mayorista" };

// El SSR solo resuelve empresa/cliente/config del demo. Los productos los trae
// el cliente directo de Typesense (instantáneo) y los precios mayoristas llegan
// por lote vía /api/b2b/prices — no bloqueamos el render con el catálogo.
export default async function NuevoPedidoPage() {
  const [customer, my, demoB2B] = await Promise.all([
    retrieveCustomer().catch(() => null),
    getMyCompany(),
    getActiveDemoB2B(),
  ]);

  // Canal mayorista: el de la empresa, o el del demo B2B. Sin ninguno, el hook
  // de Typesense cae al canal del ChannelProvider (B2C del demo) y en última
  // instancia a NEXT_PUBLIC_SALES_CHANNEL_ID — intencional: acota el universo
  // en vez de listar todo lo publicado como hacía el catálogo viejo.
  const salesChannelId =
    my.company?.sales_channel_id ?? demoB2B?.salesChannelId ?? undefined;

  return (
    <B2BOrderBuilder
      company={{ id: my.company?.id ?? "", name: my.company?.name ?? "" }}
      placedBy={{ id: customer?.id ?? "", email: customer?.email ?? "" }}
      salesChannelId={salesChannelId}
      tiers={demoB2B?.tiers}
    />
  );
}
