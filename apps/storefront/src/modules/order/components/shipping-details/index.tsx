import type { HttpTypes } from "@medusajs/types";
import { Text } from "@medusajs/ui";
import Image from "next/image";

type ShippingDetailsProps = {
  order: HttpTypes.StoreOrder;
};

const ShippingDetails = ({ order }: ShippingDetailsProps) => {
  const metadata = (order as any).metadata as
    | Record<string, string>
    | undefined;
  const isStorePickup = metadata?.shipping_method === "retiro_store";
  const isPickup =
    metadata?.shipping_method === "retiro_sucursal" || isStorePickup;
  // Andreani usa pickup_branch_name; el retiro en sucursal propia usa store_name.
  const pickupBranchName = isStorePickup
    ? [metadata?.store_name, metadata?.store_address, metadata?.store_city]
        .filter(Boolean)
        .join(" - ")
    : metadata?.pickup_branch_name;
  const shippingAddress = order.shipping_address;
  const shippingMethod = (order as any).shipping_methods?.[0]?.name;

  const addressLine = [shippingAddress?.address_1, shippingAddress?.address_2]
    .filter(Boolean)
    .join(" ");
  const cityLine = [shippingAddress?.city, shippingAddress?.province]
    .filter(Boolean)
    .join(", ");
  const locationLine = [cityLine, shippingAddress?.postal_code]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-white p-[22px] shadow-[0_10px_20px_0_#0000000D]">
      <div className="mb-4 flex items-center gap-2">
        <Image alt="Icono de envío" height={20} src="/truck.svg" width={20} />
        <Text className="text-[18px] font-semibold text-[--text-dark]">Envío</Text>
      </div>

      <div className="space-y-3">
        <div data-testid="shipping-address-summary">
          <Text className="text-[15px] font-[400] text-[#374151]">
            {isPickup ? "Dirección de facturación:" : "Dirección de envío:"}
          </Text>
          <Text className="mt-0.5 text-[15px] font-semibold text-[--text-dark]">
            {addressLine}
            {locationLine ? `, ${locationLine}` : ""}
          </Text>
        </div>

        <div data-testid="shipping-contact-summary">
          <Text className="text-[15px] font-[400] text-[#374151]">Contacto:</Text>
          <Text className="mt-0.5 text-[15px] font-semibold text-[--text-dark]">
            {shippingAddress?.phone || order.email}
          </Text>
        </div>

        <div data-testid="shipping-method-summary">
          <Text className="text-[15px] font-[400] text-[#374151]">Tipo de envío:</Text>
          <Text className="mt-0.5 text-[15px] font-semibold text-[--text-dark]">
            {shippingMethod || "Envío a domicilio"}
          </Text>
          {isPickup && pickupBranchName && (
            <Text className="mt-1 text-[15px] font-[400] text-[#374151]">
              Retiro en: {pickupBranchName}
            </Text>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShippingDetails;
