"use client";

import { formatDateAR } from "@lib/util/format-date";
import { convertToLocale } from "@lib/util/money";
import type { HttpTypes } from "@medusajs/types";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import TransportConditionBadge from "@modules/common/components/transport-condition-badge";
import { resolveOrderTemperature } from "@lib/util/transport-condition";
import { ChevronRight, Package } from "lucide-react";
import { useState } from "react";

type OverviewProps = {
  customer: HttpTypes.StoreCustomer | null;
  orders: HttpTypes.StoreOrder[] | null;
};

type StatusConfig = {
  label: string;
  className: string;
};

const FULFILLMENT_STATUS_MAP: Record<string, StatusConfig> = {
  not_fulfilled: { label: "Pendiente", className: "bg-gray-100 text-gray-600" },
  partially_fulfilled: { label: "En preparación", className: "bg-[#DBEAFE] text-[#1447E6]" },
  fulfilled: { label: "En preparación", className: "bg-[#DBEAFE] text-[#1447E6]" },
  partially_shipped: { label: "En camino", className: "bg-[#DBEAFE] text-[#1447E6]" },
  shipped: { label: "En camino", className: "bg-[#DBEAFE] text-[#1447E6]" },
  delivered: { label: "Entregado", className: "bg-green-100 text-green-700" },
  returned: { label: "Devuelto", className: "bg-orange-100 text-orange-600" },
  partially_returned: { label: "Devuelto parcial", className: "bg-orange-100 text-orange-600" },
  canceled: { label: "Cancelado", className: "bg-[#FFE2E2] text-[#C10007]" },
  requires_action: { label: "Requiere acción", className: "bg-yellow-100 text-yellow-600" },
};

const getStatusConfig = (orderStatus: string, fulfillmentStatus?: string | null): StatusConfig => {
  if (orderStatus === "canceled") {
    return { label: "Cancelado", className: "bg-red-100 text-red-600" };
  }
  if (orderStatus === "completed") {
    return { label: "Entregado", className: "bg-green-100 text-green-700" };
  }
  if (fulfillmentStatus && FULFILLMENT_STATUS_MAP[fulfillmentStatus]) {
    return FULFILLMENT_STATUS_MAP[fulfillmentStatus];
  }
  return { label: "Pendiente", className: "bg-gray-100 text-gray-600" };
};

const STATUS_FILTERS = [
  "Todos",
  "Pendiente",
  "En preparación",
  "En camino",
  "Entregado",
  "Devuelto",
  "Cancelado",
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number];

const formatDate = (input: string | Date) =>
  formatDateAR(input, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }) ?? "";

const Overview = ({ orders }: OverviewProps) => {
  const allOrders = orders || [];
  const [activeFilter, setActiveFilter] = useState<StatusFilter>("Todos");

  const filteredOrders =
    activeFilter === "Todos"
      ? allOrders
      : allOrders.filter((order) => {
          const status = getStatusConfig(order.status ?? "pending", order.fulfillment_status);
          return status.label === activeFilter;
        });

  return (
    <div data-testid="overview-page-wrapper">
      {/* Filtros de status */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => setActiveFilter(filter)}
            className={`shrink-0 rounded-full px-4 py-1.5 font-medium text-sm transition-colors ${
              activeFilter === filter
                ? "bg-[--primary-color] text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white shadow-[0px_5px_20px_0px_#0000000D]">
        <div className="space-y-3 p-4" data-testid="orders-wrapper">
          {filteredOrders.length ? (
            filteredOrders.map((order) => {
              const itemCount = order.items?.length ?? 0;
              const status = getStatusConfig(order.status ?? "pending", order.fulfillment_status);
              const formattedDate = formatDate(order.created_at);
              const coldMode = resolveOrderTemperature(order.items ?? []);

              return (
                <LocalizedClientLink
                  className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white px-4 py-3.5 transition-colors hover:bg-gray-50"
                  data-testid="order-wrapper"
                  data-value={order.id}
                  href={`/account/orders/details/${order.id}`}
                  key={order.id}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100">
                    <Package className="h-5 w-5 text-gray-500" strokeWidth={1.5} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p
                      className="font-semibold text-gray-900 text-sm"
                      data-testid="order-id"
                    >
                      #{order.custom_display_id ?? order.display_id}
                    </p>
                    <p className="text-gray-400 truncate max-w-[180px] text-xs">
                      {formattedDate}
                      {itemCount > 0 && (
                        <>
                          {" · "}
                          {itemCount}{" "}
                          {itemCount === 1 ? "producto" : "productos"}
                        </>
                      )}
                    </p>
                  </div>

                  {coldMode !== "ambient" && (
                    <TransportConditionBadge
                      iconOnly
                      mode={coldMode}
                      size="sm"
                    />
                  )}

                  <span
                    className={`shrink-0 rounded-full px-3 py-1 font-medium text-xs ${status.className}`}
                  >
                    {status.label}
                  </span>

                  {order.status !== "canceled" && (
                    <p
                      className="hidden shrink-0 font-semibold text-gray-900 text-sm sm:block"
                      data-testid="order-amount"
                    >
                      {"$ "}
                      {convertToLocale({
                        amount: order.total,
                        currency_code: order.currency_code,
                      })}
                    </p>
                  )}

                  <ChevronRight className="hidden h-4 w-4 shrink-0 text-gray-400 sm:block" strokeWidth={2} />
                </LocalizedClientLink>
              );
            })
          ) : (
            <div
              className="py-10 text-center"
              data-testid="no-orders-message"
            >
              <Package className="mx-auto mb-3 h-10 w-10 text-gray-300" strokeWidth={1.5} />
              <p className="font-semibold text-gray-700 text-sm">
                {activeFilter === "Todos"
                  ? "Todavía no tenés pedidos"
                  : `No tenés pedidos con estado "${activeFilter}"`}
              </p>
              <p className="mt-1 text-gray-400 text-sm">
                {activeFilter === "Todos"
                  ? "Cuando realices una compra, la vas a ver acá."
                  : "Probá con otro filtro."}
              </p>
              {activeFilter === "Todos" && (
                <LocalizedClientLink
                  className="mt-4 inline-flex justify-center rounded-md bg-[--primary-color] px-4 py-2 font-semibold text-sm text-white shadow-none hover:bg-[--primary-color-dark]"
                  href="/"
                >
                  Ir a la tienda
                </LocalizedClientLink>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Overview;
