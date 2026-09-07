"use client";

import { useChannel } from "@lib/context/channel-context";
import { useTenantBrand } from "@lib/site-config/context";
import { useAuth } from "@lib/hooks/use-auth";
import {
  type ForgotPasswordInput,
  forgotPasswordSchema,
} from "@lib/validation/auth";
import { LOGIN_VIEW } from "@modules/account/templates/login-template";
import ErrorMessage from "@modules/checkout/components/error-message";
import FormInput from "@modules/common/components/form-input";
import { zodResolver } from "@lib/util/zod-resolver";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

type Props = {
  setCurrentView: (view: LOGIN_VIEW) => void;
};

const ForgotPassword = ({ setCurrentView }: Props) => {
  const [sent, setSent] = useState(false);
  const { requestResetPassword, isLoading, error } = useAuth();
  const { config } = useChannel();
  const { logos, name: brandName } = useTenantBrand();
  const logoSrc = logos?.main || "/logo.webp";
  const { countryCode } = useParams<{ countryCode: string }>();

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: "onChange",
    defaultValues: { email: "" },
  });

  const onSubmit = async ({ email }: ForgotPasswordInput) => {
    if (!(config.salesChannelId && countryCode)) {
      return;
    }
    const result = await requestResetPassword(email, {
      salesChannelId: config.salesChannelId,
      countryCode,
    });
    if (result.success) {
      setSent(true);
    }
  };

  if (sent) {
    return (
      <div
        className="flex w-full flex-col items-center"
        data-testid="forgot-password-sent"
      >
        <div className="animate-auth-logo mb-4 flex justify-center">
          {/* biome-ignore lint/a11y/useAltText: alt provisto */}
          <img alt={brandName} className="h-10 w-auto object-contain" src={logoSrc} />
        </div>
        <h1 className="animate-auth-title mb-2 text-center font-semibold text-gray-900 text-xl">
          Revisá tu correo
        </h1>
        <p className="animate-auth-subtitle mb-6 text-center text-gray-600 text-sm">
          Si existe una cuenta con ese correo, te enviamos instrucciones para
          restablecer tu contraseña.
        </p>
        <button
          className="animate-auth-button w-full min-h-[44px] rounded-xl bg-[--primary-color] px-4 py-3 font-semibold text-base text-white transition-colors hover:bg-[--primary-color-dark]"
          onClick={() => setCurrentView(LOGIN_VIEW.SIGN_IN)}
          type="button"
        >
          Volver al inicio de sesión
        </button>
      </div>
    );
  }

  return (
    <div
      className="flex w-full flex-col items-center"
      data-testid="forgot-password-page"
    >
      <div className="animate-auth-logo mb-4 flex justify-center">
        {/* biome-ignore lint/a11y/useAltText: alt provisto */}
        <img alt={brandName} className="h-10 w-auto object-contain" src={logoSrc} />
      </div>
      <h1 className="animate-auth-title mb-2 text-center text-[32px] font-bold leading-tight text-[var(--text-dark)]">
        ¿Olvidaste tu contraseña?
      </h1>
      <p className="animate-auth-subtitle mb-6 text-center text-sm font-normal text-[var(--text-muted)]">
        Escribí tu correo electrónico para recuperarla.
      </p>
      <form
        className="flex w-full flex-col gap-3"
        noValidate
        onSubmit={handleSubmit(onSubmit)}
      >
        <div className="animate-auth-field-1">
          <FormInput
            autoComplete="email"
            data-testid="forgot-email-input"
            icon={
              <svg
                fill="none"
                height="18"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
                viewBox="0 0 24 24"
                width="18"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect height="16" rx="2" ry="2" width="20" x="2" y="4" />
                <path d="M22 4l-10 7L2 4" />
              </svg>
            }
            hasError={!!errors.email}
            label="Correo electrónico"
            placeholder="ejemplo@correo.com"
            required
            title="Ingresá un correo electrónico válido"
            type="email"
            {...register("email")}
          />
          {errors.email && (
            <p className="mt-1 text-red-600 text-xs">{errors.email.message}</p>
          )}
        </div>
        <ErrorMessage data-testid="forgot-error-message" error={error} />
        <button
          className="animate-auth-button mt-1 w-full min-h-[44px] rounded-xl bg-[--primary-color] px-4 py-3 font-semibold text-base text-white transition-colors hover:bg-[--primary-color-dark] disabled:cursor-not-allowed disabled:opacity-50"
          data-testid="request-reset-button"
          disabled={isLoading || !isValid}
          type="submit"
        >
          {isLoading ? "Enviando..." : "Enviar enlace"}
        </button>
      </form>
      <p className="animate-auth-footer mt-4 text-center text-gray-500 text-sm">
        <button
          className="font-medium text-sm text-[--primary-color] underline"
          data-testid="back-to-login"
          onClick={() => setCurrentView(LOGIN_VIEW.SIGN_IN)}
          type="button"
        >
          Volver a iniciar sesión
        </button>
      </p>
    </div>
  );
};

export default ForgotPassword;
