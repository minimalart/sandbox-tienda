import { getMyCredit } from "@lib/data/company-credit";
import { retrieveCustomer } from "@lib/data/customer";
import { getRecurringEnabled } from "@lib/site-config/active-tenant";
import { Toaster } from "@medusajs/ui";
import AccountLayout from "@modules/account/templates/account-layout";
import type { Metadata } from "next";

/**
 * `noindex` para TODA la cuenta.
 *
 * Es la sesión del cliente: pedidos, direcciones, billetera. El `robots.txt` la
 * bloquea, pero la auditoría del 19/08 igual crawleó `/tienda/<slug>/account` (el
 * disallow no llevaba el prefijo de tienda) y no encontró NINGUNA página noindex en el
 * storefront. Vale acá y no en cada `page.tsx`: el layout cubre el árbol entero,
 * incluidos los slots `@dashboard`/`@login`.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AccountPageLayout({
  dashboard,
  login,
}: {
  dashboard?: React.ReactNode;
  login?: React.ReactNode;
}) {
  const customer = await retrieveCustomer().catch(() => null);

  // Solo mostramos el link de Cuenta Corriente si la empresa del cliente tiene
  // una cuenta creada (empresas B2B mayorista con crédito habilitado).
  const hasCredit = customer
    ? await getMyCredit()
        .then((c) => !!c.account)
        .catch(() => false)
    : false;

  // "Compras recurrentes" aparece cuando el tenant tiene la feature habilitada.
  const hasRecurring = await getRecurringEnabled().catch(() => false);

  return (
    <AccountLayout
      customer={customer}
      hasCredit={hasCredit}
      hasRecurring={hasRecurring}
    >
      {customer ? dashboard : login}
      <Toaster />
    </AccountLayout>
  );
}
