import LoyaltyOverview from "@minimalart/mercatto-plugin-loyalty/storefront/account/loyalty-overview";
import LoyaltyRewards from "@minimalart/mercatto-plugin-loyalty/storefront/account/loyalty-rewards";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Fidelización",
  description: "Tu saldo de puntos, tu nivel y las recompensas que podés canjear.",
};

export default function LoyaltyPage() {
  return (
    <div className="space-y-6" data-testid="loyalty-page-wrapper">
      <div>
        <h2 className="font-semibold text-base/7 text-gray-900">Fidelización</h2>
        <p className="mt-1 text-gray-500 text-sm/6">
          Acumulás puntos con cada compra. Acá ves tu saldo, tu nivel y podés canjear recompensas.
        </p>
      </div>
      <LoyaltyOverview />
      <LoyaltyRewards />
    </div>
  );
}
