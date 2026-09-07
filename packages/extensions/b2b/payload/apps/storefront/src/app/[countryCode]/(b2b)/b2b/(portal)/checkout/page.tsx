import { retrieveB2BCart } from "@lib/data/b2b-cart";
import { getMyCompany, type CompanyAddress } from "@lib/data/company";
import { getMyCredit } from "@lib/data/company-credit";
import { retrieveCustomer } from "@lib/data/customer";
import B2BCheckoutFlow from "@modules/b2b/components/b2b-checkout-flow";
import PageHeader from "@modules/b2b/components/portal/page-header";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Finalizar pedido | Mayorista" };

export default async function B2BCheckoutPage(props: {
  params: Promise<{ countryCode: string }>;
}) {
  const { countryCode } = await props.params;
  const [cart, customer, my] = await Promise.all([
    retrieveB2BCart(),
    retrieveCustomer().catch(() => null),
    getMyCompany(),
  ]);

  if (!cart || !cart.items?.length) {
    redirect(`/${countryCode}/b2b/pedidos/nuevo`);
  }

  // Saldo de cuenta corriente (si la empresa tiene cuenta): el gate por saldo
  // se calcula en el cliente contra el total vivo del carrito.
  const credit = await getMyCredit(cart.total ?? undefined).then((c) => c.account).catch(() => null);

  const addresses = ((my.company?.metadata as Record<string, unknown> | null)?.addresses as
    | CompanyAddress[]
    | undefined) ?? [];

  const userName =
    [customer?.first_name, customer?.last_name].filter(Boolean).join(" ") ||
    customer?.email ||
    "";

  return (
    <div className="space-y-5">
      <LocalizedClientLink
        href="/b2b/pedidos"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Volver a mis pedidos
      </LocalizedClientLink>
      <PageHeader title="Finalizar pedido" description="Revisá el pedido, elegí el envío y confirmá." />
      <B2BCheckoutFlow
        cart={cart}
        email={customer?.email ?? ""}
        userName={userName}
        companyName={my.company?.name ?? ""}
        addresses={addresses}
        countryCode={countryCode}
        googleMapsApiKey={process.env.GOOGLE_MAPS_API_KEY ?? ""}
        credit={credit}
      />
    </div>
  );
}
