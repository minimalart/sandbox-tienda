import { filterCreditPaymentMethod } from "@lib/data/company-credit";
import { listCartShippingMethods } from "@lib/data/fulfillment";
import { listCartPaymentMethods } from "@lib/data/payment";
import type { HttpTypes } from "@medusajs/types";
import Addresses from "@modules/checkout/components/addresses";
import Payment from "@modules/checkout/components/payment";
import Shipping from "@modules/checkout/components/shipping";

export default async function CheckoutForm({
  cart,
  customer,
}: {
  cart: HttpTypes.StoreCart | null;
  customer: HttpTypes.StoreCustomer | null;
}) {
  if (!cart) {
    return null;
  }

  const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY ?? "";
  const shippingMethods = await listCartShippingMethods(cart.id);
  const rawPaymentMethods = await listCartPaymentMethods(cart.region?.id ?? "");

  if (!(shippingMethods && rawPaymentMethods)) {
    return null;
  }

  // Oculta "Cuenta Corriente" salvo empresa con cuenta activa y crédito suficiente.
  const paymentMethods = await filterCreditPaymentMethod(
    rawPaymentMethods,
    Number(cart.total ?? 0),
  );

  return (
    <div className="grid w-full grid-cols-1 gap-y-8">
      <Addresses
        cart={cart}
        customer={customer}
        googleMapsApiKey={googleMapsApiKey}
      />

      <Shipping availableShippingMethods={shippingMethods} cart={cart} />

      <Payment availablePaymentMethods={paymentMethods} cart={cart} />
    </div>
  );
}
