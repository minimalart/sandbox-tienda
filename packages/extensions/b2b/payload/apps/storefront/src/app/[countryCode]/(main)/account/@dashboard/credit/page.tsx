import { getMyCredit, listMyCreditTransactions } from "@lib/data/company-credit";
import { retrieveCustomer } from "@lib/data/customer";
import CreditStatement from "@modules/account/components/credit/credit-statement";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  title: "Cuenta Corriente",
  description: "Estado de tu línea de crédito comercial y movimientos.",
};

export default async function CreditPage() {
  const customer = await retrieveCustomer();
  if (!customer) {
    notFound();
  }

  const { account } = await getMyCredit();

  if (!account) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="font-semibold text-base/7 text-gray-900">Cuenta Corriente</h2>
          <p className="mt-1 text-gray-500 text-sm/6">
            Tu empresa todavía no tiene una cuenta corriente habilitada.
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <p className="text-gray-600 text-sm">
            La cuenta corriente permite comprar a crédito. Consultá con tu ejecutivo
            comercial para habilitarla.
          </p>
          <LocalizedClientLink
            className="mt-4 inline-flex min-h-[40px] items-center rounded-xl border border-gray-300 px-4 py-2 font-semibold text-gray-700 text-sm"
            href="/account/orders"
          >
            Volver a mis pedidos
          </LocalizedClientLink>
        </div>
      </div>
    );
  }

  const { transactions } = await listMyCreditTransactions({ limit: 200 });

  return <CreditStatement account={account} initialTransactions={transactions} />;
}
