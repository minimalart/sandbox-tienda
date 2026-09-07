import WishlistOverview from "@modules/account/components/wishlist-overview";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mis Favoritos",
  description: "Tus productos favoritos guardados para más tarde.",
};

export default function WishlistPage() {
  return (
    <div className="space-y-6" data-testid="wishlist-page-wrapper">
      <div>
        <h2 className="font-semibold text-base/7 text-gray-900">
          Favoritos
        </h2>
        <p className="mt-1 text-gray-500 text-sm/6">
          Tus productos guardados. Agregálos al carrito cuando quieras.
        </p>
      </div>
      <WishlistOverview />
    </div>
  );
}
