"use client";

import type { HttpTypes } from "@medusajs/types";
import { Button } from "@medusajs/ui";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import OrderCard from "../order-card";

const OrderOverview = ({ orders }: { orders: HttpTypes.StoreOrder[] }) => {
  if (orders?.length) {
    return (
      <div className="flex w-full flex-col gap-y-6">
        {orders.map((o) => (
          <OrderCard key={o.id} order={o} />
        ))}
      </div>
    );
  }

  return (
    <div
      className="flex w-full flex-col items-center gap-y-4 text-center"
      data-testid="no-orders-container"
    >
      <h3 className="font-semibold text-gray-900 text-lg">
        Todavía no tenés pedidos
      </h3>
      <p className="text-gray-500 text-sm">
        Cuando realices una compra, vas a ver el seguimiento y detalle en esta
        sección.
      </p>
      <LocalizedClientLink href="/" passHref>
        <Button
          className="bg-[--primary-color] px-5 py-2 font-semibold text-sm text-white shadow-none hover:bg-[--primary-color-dark]"
          data-testid="continue-shopping-button"
        >
          Seguir comprando
        </Button>
      </LocalizedClientLink>
    </div>
  );
};

export default OrderOverview;
