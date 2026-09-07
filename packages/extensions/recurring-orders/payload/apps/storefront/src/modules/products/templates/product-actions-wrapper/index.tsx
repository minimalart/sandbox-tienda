import type { HttpTypes } from "@medusajs/types";
import type { ReactNode } from "react";
import { retrieveCustomer } from "@lib/data/customer";
import { getRecurringEligibilityDetail, getSubscriptionPlans } from "@lib/data/recurring-orders";
import { getRecurringEnabled } from "@lib/site-config/active-tenant";
import type { FragranceItem } from "@modules/products/components/fragrance-selector";
import type { KitProductDetails } from "@modules/products/components/product-actions";
import ProductActions from "@modules/products/components/product-actions";
import type {
  SubscribeAddressOption,
  SubscriptionActionConfig,
} from "@modules/products/components/subscribe-action";

/**
 * Renders product actions. Uses pre-fetched product if provided,
 * otherwise fetches by ID (fallback for Suspense boundaries).
 *
 * Server component: also resolves the recurring-purchases config (tenant
 * toggle + session + addresses) that gates the "Suscribirse" block.
 */
export default async function ProductActionsWrapper({
  id,
  region,
  product: prefetchedProduct,
  inStock,
  fragrances,
  kitDetails,
  afterPriceActions,
}: {
  id: string;
  region: HttpTypes.StoreRegion;
  product?: HttpTypes.StoreProduct;
  inStock?: boolean;
  fragrances?: FragranceItem[];
  kitDetails?: KitProductDetails | null;
  afterPriceActions?: ReactNode;
}) {
  const product =
    prefetchedProduct ??
    (await (async () => {
      const countryCode = region.countries?.[0]?.iso_2 || "ar";
      const mod = await import("@lib/data/channel-products");
      return mod.getChannelProductById(id, countryCode, true);
    })());

  if (!product) {
    return null;
  }

  let subscription: SubscriptionActionConfig | undefined;
  const recurringEnabled = await getRecurringEnabled().catch(() => false);
  // Además del toggle del tenant, el producto tiene que ser elegible según el
  // scope configurado (todos / seleccionados por categoría, etiqueta o id).
  const eligibility = recurringEnabled
    ? await getRecurringEligibilityDetail([product.id])
    : { eligible: [], discounts: {} };
  const planResult = recurringEnabled
    ? await getSubscriptionPlans({ productIds: [product.id] })
    : { plans: [], automatic_payments_enabled: false };
  if (
    recurringEnabled &&
    (eligibility.eligible.includes(product.id) || planResult.plans.length > 0)
  ) {
    const customer = await retrieveCustomer().catch(() => null);
    const addresses: SubscribeAddressOption[] = (customer?.addresses ?? []).map(
      (a) => ({
        id: a.id,
        label:
          [a.address_1, a.address_2].filter(Boolean).join(" ") || "Dirección",
        detail: [a.city, a.province, a.postal_code].filter(Boolean).join(", "),
      }),
    );
    subscription = {
      enabled: true,
      isLoggedIn: Boolean(customer),
      addresses,
      discounts: eligibility.discounts[product.id] ?? [],
      plans: planResult.plans,
      automaticPaymentsEnabled: planResult.automatic_payments_enabled,
    };
  }

  return (
    <ProductActions
      product={product}
      region={region}
      description={product.description ?? undefined}
      productPage={true}
      inStock={inStock}
      fragrances={fragrances}
      kitDetails={kitDetails}
      afterPriceActions={afterPriceActions}
      subscription={subscription}
    />
  );
}
