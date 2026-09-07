import { z } from "zod";
import { optionalPhoneSchema } from "./phone";

export const profileNameSchema = z.object({
  first_name: z.string().min(1, "Ingresá tu nombre"),
  last_name: z.string().min(1, "Ingresá tu apellido"),
});
export type ProfileNameInput = z.infer<typeof profileNameSchema>;

export const profilePhoneSchema = z.object({
  phone: optionalPhoneSchema,
});
export type ProfilePhoneInput = z.infer<typeof profilePhoneSchema>;

export const customerDetailsSchema = z.object({
  first_name: z.string().min(1, "Ingresá tu nombre"),
  last_name: z.string().min(1, "Ingresá tu apellido"),
  phone: optionalPhoneSchema,
});
export type CustomerDetailsInput = z.infer<typeof customerDetailsSchema>;

// Límites del avatar — deben coincidir con la validación del backend
// (apps/backend/src/api/store/customers/me/avatar/route.ts).
export const AVATAR_ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024; // 2MB
export const AVATAR_ACCEPT_ATTR = AVATAR_ACCEPTED_TYPES.join(",");

/** Valida un archivo de avatar en el cliente. Devuelve un mensaje de error o null si es válido. */
export function validateAvatarFile(file: File): string | null {
  if (!AVATAR_ACCEPTED_TYPES.includes(file.type)) {
    return "Formato no permitido. Subí una imagen JPG, PNG o WebP.";
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return "La imagen supera el peso máximo de 2MB.";
  }
  return null;
}
