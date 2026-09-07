import { z } from 'zod';

const PayerIdentification = z.object({
  type: z.string(),
  number: z.string(),
});

const PayerWithEmail = z.object({
  email: z.string(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  identification: PayerIdentification,
});

const PayerWithId = z.object({
  type: z.string(),
  id: z.string(),
});

const AdditionalInfoItem = z.object({
  id: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  picture_url: z.string().optional(),
  category_id: z.string().optional(),
  quantity: z.number().optional(),
  unit_price: z.number().optional(),
});

const AdditionalInfoPayer = z.object({
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  phone: z
    .object({ area_code: z.string().optional(), number: z.string().optional() })
    .optional(),
  address: z
    .object({
      zip_code: z.string().optional(),
      street_name: z.string().optional(),
      street_number: z.number().optional(),
    })
    .optional(),
  registration_date: z.string().optional(),
});

const AdditionalInfo = z.object({
  items: z.array(AdditionalInfoItem).optional(),
  payer: AdditionalInfoPayer.optional(),
});

// The storefront forwards the MercadoPago Payment Brick's formData verbatim and
// MercadoPago is the source of truth for per-method validation. We only assert
// the couple of fields our workflow needs (amount + method) and let the rest
// pass through, so BOTH card (token + installments + payer) and cash/ticket
// (Rapipago, Pago Fácil — no token/installments, payer may omit identification)
// payloads are accepted.
//
// A strict `z.union([card, ticket])` rejected cash: the Brick's ticket payer can
// omit `identification`, so the ticket branch failed too and Zod surfaced the
// card branch's misleading "Field 'paymentData, token' is required".
const PaymentData = z
  .object({
    transaction_amount: z.number().min(1),
    payment_method_id: z.string().min(1),
    token: z.string().optional(),
    installments: z.number().optional(),
    issuer_id: z.union([z.string(), z.number()]).optional(),
    payer: z.union([PayerWithEmail, PayerWithId, z.record(z.string(), z.any())]).optional(),
    description: z.string().optional(),
    statement_descriptor: z.string().optional(),
    binary_mode: z.boolean().optional(),
    capture: z.boolean().optional(),
    additional_info: AdditionalInfo.optional(),
  })
  .passthrough();

export type PostStoreMercadopagoPaymentType = z.infer<typeof PostStoreMercadopagoPayment>;
export const PostStoreMercadopagoPayment = z.object({
  paymentSessionId: z.string().min(1),
  /** The Medusa cart id — used to resolve the sales channel and link the webhook. */
  cart_id: z.string().min(1),
  paymentData: PaymentData,
  device_session_id: z.string().optional(),
});
