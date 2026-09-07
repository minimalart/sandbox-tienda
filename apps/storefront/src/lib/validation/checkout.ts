import { z } from "zod";

export const personalInfoSchema = z.object({
  first_name: z.string().min(1, "Ingresá tu nombre"),
  last_name: z.string().min(1, "Ingresá tu apellido"),
  email: z
    .string()
    .min(1, "Ingresá tu correo electrónico")
    .email("Ingresá un correo electrónico válido"),
});
export type PersonalInfoInput = z.infer<typeof personalInfoSchema>;

export const discountCodeSchema = z.object({
  code: z.string().trim().min(1, "Ingresá un código"),
});
export type DiscountCodeInput = z.infer<typeof discountCodeSchema>;

export const giftCardCodeSchema = z.object({
  code: z.string().trim().min(1, "Ingresá un código"),
});
export type GiftCardCodeInput = z.infer<typeof giftCardCodeSchema>;
