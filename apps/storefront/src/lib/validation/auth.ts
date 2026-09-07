import { z } from "zod";
import { optionalPhoneSchema } from "./phone";

const emailSchema = z
  .string()
  .min(1, "Ingresá tu correo electrónico")
  .email("Ingresá un correo electrónico válido");

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Ingresá tu contraseña"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    first_name: z.string().min(1, "Ingresá tu nombre"),
    last_name: z.string().min(1, "Ingresá tu apellido"),
    email: emailSchema,
    phone: optionalPhoneSchema,
    password: z
      .string()
      .min(8, "La contraseña debe tener al menos 8 caracteres"),
    confirm_password: z.string().min(1, "Repetí tu contraseña"),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: "Las contraseñas no coinciden",
    path: ["confirm_password"],
  });
export type RegisterInput = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

/** change-password-card: confirma identidad con la contraseña actual. */
export const changePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1, "Ingresá tu contraseña actual"),
});
export type ChangePasswordRequestInput = z.infer<
  typeof changePasswordRequestSchema
>;

/** profile-password: actualiza la contraseña (actual + nueva + confirmación). */
export const updatePasswordSchema = z
  .object({
    old_password: z.string().min(1, "Ingresá tu contraseña actual"),
    new_password: z
      .string()
      .min(8, "La contraseña debe tener al menos 8 caracteres"),
    confirm_password: z.string().min(1, "Repetí la nueva contraseña"),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: "Las contraseñas no coinciden",
    path: ["confirm_password"],
  });
export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;
