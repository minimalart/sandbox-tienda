import { z } from "zod";
import { optionalPhoneSchema } from "./phone";

const emailField = z
  .string()
  .min(1, "Ingresá tu correo electrónico")
  .email("Ingresá un correo electrónico válido");

export const contactSchema = z.object({
  first_name: z.string().trim().min(2, "Ingresá tu nombre"),
  last_name: z.string().trim().min(2, "Ingresá tu apellido"),
  email: emailField,
  phone: optionalPhoneSchema,
  message: z.string().trim().min(10, "El mensaje debe tener al menos 10 caracteres"),
  // Honeypot anti-bot: se envía pero no se valida (los humanos lo dejan vacío).
  honeypot: z.string().optional(),
});
export type ContactInput = z.infer<typeof contactSchema>;

export const newsletterSchema = z.object({
  email: emailField,
});
export type NewsletterInput = z.infer<typeof newsletterSchema>;
