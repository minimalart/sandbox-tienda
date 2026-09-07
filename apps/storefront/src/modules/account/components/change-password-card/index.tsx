"use client";

import { useChannel } from "@lib/context/channel-context";
import {
  type ChangePasswordRequestInput,
  changePasswordRequestSchema,
} from "@lib/validation/auth";
import { zodResolver } from "@lib/util/zod-resolver";
import type { HttpTypes } from "@medusajs/types";
import PasswordInput from "@modules/common/components/password-input";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

type Props = {
  customer: HttpTypes.StoreCustomer;
};

const ChangePasswordCard = ({ customer }: Props) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const { config } = useChannel();
  const { countryCode } = useParams<{ countryCode: string }>();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isValid },
  } = useForm<ChangePasswordRequestInput>({
    resolver: zodResolver(changePasswordRequestSchema),
    mode: "onChange",
    defaultValues: { currentPassword: "" },
  });

  const onSubmit = async ({ currentPassword }: ChangePasswordRequestInput) => {
    setError(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/store/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "changePassword",
          email: customer.email,
          currentPassword,
          sales_channel_id: config.salesChannelId,
          country_code: countryCode,
        }),
      });

      const result = await response.json();
      if (result.success) {
        setSuccessMessage(result.message);
        reset({ currentPassword: "" });
      } else {
        setError(result.message || "Error al enviar el link");
      }
    } catch {
      setError("Error de conexión. Intentá nuevamente.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-[0px_5px_20px_0px_#0000000D]">
      <h2 className="mb-1 font-semibold text-base text-gray-900">
        Cambiar contraseña
      </h2>
      <p className="mb-5 text-gray-500 text-xs">
        Confirmá tu identidad y te enviaremos un link para establecer una nueva
        contraseña.
      </p>

      {successMessage && (
        <div className="mb-4 rounded-lg bg-green-50 p-3 text-green-800 text-sm">
          {successMessage}
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-red-800 text-sm">
          {error}
        </div>
      )}

      <form
        className="space-y-4"
        noValidate
        onSubmit={handleSubmit(onSubmit)}
      >
        <div>
          <PasswordInput
            hasError={!!errors.currentPassword}
            label="Contraseña actual"
            placeholder="Mínimo 8 caracteres"
            required
            {...register("currentPassword")}
          />
          {errors.currentPassword && (
            <p className="mt-1 text-red-600 text-xs">
              {errors.currentPassword.message}
            </p>
          )}
        </div>

        <button
          className="mt-2 w-full rounded-lg bg-[--primary-color] px-4 py-2.5 font-semibold text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          disabled={isLoading || !isValid}
          type="submit"
        >
          {isLoading ? "Verificando..." : "Enviar link de cambio"}
        </button>
      </form>
    </div>
  );
};

export default ChangePasswordCard;
