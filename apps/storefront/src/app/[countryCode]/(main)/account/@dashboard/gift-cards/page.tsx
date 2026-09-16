import { getGiftCardsEnabled } from "@lib/site-config/active-tenant";
import GiftCardsOverview from "@modules/account/components/gift-cards-overview";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  title: "Mis Tarjetas de Regalo",
  description: "Canjeá códigos y consultá el saldo de tus tarjetas de regalo.",
};

export default async function GiftCardsPage() {
  // Igual que fidelización: el gate tiene que cerrar la RUTA, no sólo el link.
  if (!(await getGiftCardsEnabled().catch(() => true))) {
    notFound();
  }

  return (
    <div className="space-y-6" data-testid="gift-cards-page-wrapper">
      <div>
        <h2 className="font-semibold text-base/7 text-gray-900">
          Mis tarjetas de regalo
        </h2>
        <p className="mt-1 text-gray-500 text-sm/6">
          Canjeá un código para sumar saldo y usalo en tus próximas compras.
        </p>
      </div>
      <GiftCardsOverview />
    </div>
  );
}
