import { isStripe, paymentInfoMap } from "@lib/constants";
import { formatDateTimeAR } from "@lib/util/format-date";
import { convertToLocale } from "@lib/util/money";
import type { HttpTypes } from "@medusajs/types";
import { Container, Text } from "@medusajs/ui";
import Image from "next/image";

type PaymentDetailsProps = {
  order: HttpTypes.StoreOrder;
};

const PaymentDetails = ({ order }: PaymentDetailsProps) => {
  const payment = order.payment_collections?.[0].payments?.[0];
  const paymentInfo = payment
    ? paymentInfoMap[payment.provider_id] ?? {
        title: payment.provider_id.replaceAll("_", " "),
        icon: <Image alt="Icono de pago" height={16} src="/credit-card.svg" width={16} />,
      }
    : null;

  const paidAt = formatDateTimeAR(payment?.created_at);

  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-white p-[22px] shadow-[0_10px_20px_0_#0000000D]">
      <div className="mb-4 flex items-center gap-2">
        <Image alt="Icono de pago" height={20} src="/credit-card.svg" width={20} />
        <Text className="text-[18px] font-semibold text-[--text-dark]">Pago</Text>
      </div>

      {payment && paymentInfo ? (
        <div className="space-y-3">
          <div>
            <Text className="text-[15px] font-[400] text-[#374151]">Método de pago</Text>
            <Text className="mt-0.5 text-[15px] font-semibold text-[--text-dark]" data-testid="payment-method">
              {paymentInfo.title}
            </Text>
          </div>

          <div>
            <Text className="text-[15px] font-[400] text-[#374151]">Detalles del pago:</Text>
            <div className="mt-1 flex items-center gap-2">
              <div className="flex h-10 w-10 border border-[#D1D5DB] rounded-lg items-center justify-center bg-transparent p-1">
              <Image alt="Icono de pago" height={20} src="/credit-card.svg" width={20} />
              </div>
              <Text className="text-[15px] font-semibold text-[--text-dark]" data-testid="payment-amount">
                {isStripe(payment.provider_id) && payment.data?.card_last4
                  ? `**** **** **** ${payment.data.card_last4}`
                  : `${convertToLocale({
                      amount: payment.amount,
                      currency_code: order.currency_code,
                    })} pagados el ${paidAt}`}
              </Text>
            </div>
          </div>
        </div>
      ) : (
        <Text className="text-[15px] font-[400] text-[#374151]">Sin información de pago.</Text>
      )}
    </div>
  );
};

export default PaymentDetails;
