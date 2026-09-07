import type { HttpTypes } from "@medusajs/types";
import type {
  RecurringDiscount,
  SubscriptionPlan,
} from "@lib/data/recurring-orders";
import TransportConditionNotice from "@modules/common/components/transport-condition-notice";
import type { SubscribeAddressOption } from "@modules/products/components/subscribe-action";
import EmptyCartMessage from "../components/empty-cart-message";
import MakeRecurring from "../components/make-recurring";
import ItemsTemplate from "./items";
import Summary from "./summary";

const CartTemplate = ({
  cart,
  customer,
  recurringEnabled = false,
  recurringEligibleProductIds = [],
  recurringDiscounts = {},
  subscriptionPlans = [],
  automaticPaymentsEnabled = false,
}: {
  cart: HttpTypes.StoreCart | null;
  customer: HttpTypes.StoreCustomer | null;
  /** Compras recurrentes habilitadas para el tenant (resuelto en la page). */
  recurringEnabled?: boolean;
  /** Productos del carrito elegibles según el scope del canal. */
  recurringEligibleProductIds?: string[];
  /** Descuentos de suscripción por producto (% por frecuencia). */
  recurringDiscounts?: Record<string, RecurringDiscount[]>;
  /** Planes V2 publicados aplicables a alguna línea del carrito. */
  subscriptionPlans?: SubscriptionPlan[];
  automaticPaymentsEnabled?: boolean;
}) => (
  <div className="bg-white">
    <main
      className="mx-auto max-w-2xl px-4 pt-16 pb-24 sm:px-6 lg:max-w-7xl lg:px-8"
      data-testid="cart-container"
    >
      <h1 className="font-bold text-3xl text-gray-900 tracking-tight sm:text-4xl">
        Carrito de compras
      </h1>

      {cart && cart.items && Array.isArray(cart.items) && cart.items.length > 0 ? (
        <form className="mt-12 lg:grid lg:grid-cols-12 lg:items-start lg:gap-x-12 xl:gap-x-16">
          <section aria-labelledby="cart-heading" className="lg:col-span-7">
            <h2 className="sr-only" id="cart-heading">
              Productos en tu carrito
            </h2>
            <TransportConditionNotice
              className="mb-4"
              items={cart.items ?? []}
            />
            <ItemsTemplate cart={cart} />
          </section>

          <section
            aria-labelledby="summary-heading"
            className="mt-16 rounded-lg bg-gray-50 px-4 py-6 sm:p-6 lg:col-span-5 lg:mt-0 lg:p-8"
          >
            <Summary cart={cart as any} />
            {recurringEnabled && (
              <MakeRecurring
                addresses={(customer?.addresses ?? []).map(
                  (a): SubscribeAddressOption => ({
                    id: a.id,
                    label:
                      [a.address_1, a.address_2].filter(Boolean).join(" ") ||
                      "Dirección",
                    detail: [a.city, a.province, a.postal_code]
                      .filter(Boolean)
                      .join(", "),
                  }),
                )}
                cart={cart}
                discounts={recurringDiscounts}
                eligibleProductIds={recurringEligibleProductIds}
                isLoggedIn={Boolean(customer)}
                plans={subscriptionPlans}
                automaticPaymentsEnabled={automaticPaymentsEnabled}
              />
            )}
          </section>
        </form>
      ) : (
        <div className="mt-12">
          <EmptyCartMessage />
        </div>
      )}
    </main>
  </div>
);

export default CartTemplate;
