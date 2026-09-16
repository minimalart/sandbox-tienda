"use client";

import { useAuth } from "@lib/hooks/use-auth";
import { useDemoHref, useTenantBrand } from "@lib/site-config/context";
import { useSubscriptionConsent } from "@lib/hooks/use-subscription-consent";
import { type RegisterInput, registerSchema } from "@lib/validation/auth";
import { LOGIN_VIEW } from "@modules/account/templates/login-template";
import ErrorMessage from "@modules/checkout/components/error-message";
import FormInput from "@modules/common/components/form-input";
import PasswordInput from "@modules/common/components/password-input";
import PhoneInput from "@modules/common/components/phone-input";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import { zodResolver } from "@lib/util/zod-resolver";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

type Props = {
  setCurrentView: (view: LOGIN_VIEW) => void;
};

const Register = ({ setCurrentView }: Props) => {
  const { countryCode } = useParams() as { countryCode: string };
  const { signup, loginWithGoogle, isLoading, error } = useAuth();
  const { logos, name: brandName } = useTenantBrand();
  const demoHref = useDemoHref();
  const { recordConsent } = useSubscriptionConsent();
  // Marketing-consent checkbox is hidden on the register form; default to no
  // silent opt-in. Flip to true if implicit subscription on sign-up is desired.
  const [acceptsMarketing] = useState(false);

  // El botón de Google se muestra solo si el proyecto activó la integración.
  const googleEnabled =
    process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true";

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    mode: "onChange",
    defaultValues: {
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      password: "",
      confirm_password: "",
    },
  });

  const onSubmit = async (data: RegisterInput) => {
    const result = await signup({
      email: data.email,
      password: data.password,
      first_name: data.first_name,
      last_name: data.last_name,
      phone: data.phone || "",
    });

    if (result.success) {
      if (acceptsMarketing) {
        recordConsent({ email: data.email, source: "register" });
      }
      window.location.href = demoHref("/store");
    }
  };

  return (
    <>
      <div
        className="flex w-full flex-col items-center"
        data-testid="register-page"
      >
        <div className="animate-auth-logo mb-3 flex justify-center">
          {/* biome-ignore lint/a11y/useAltText: alt provisto */}
          <img
            alt={brandName}
            className="h-8 w-auto object-contain sm:h-10"
            src={logos?.main || "/logos-mercatto/logocompleto-verde.svg"}
          />
        </div>
        <p className="animate-auth-subtitle mb-4 text-center text-sm font-normal text-[var(--text-muted)] sm:mb-5">
          Crea tu cuenta para gestionar pedidos y favoritos.
        </p>
        <form
          className="flex w-full flex-col gap-2.5"
          noValidate
          onSubmit={handleSubmit(onSubmit)}
        >
          <div className="animate-auth-field-1 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <div className="flex flex-col gap-0.5">
              <FormInput
                autoComplete="given-name"
                data-testid="first-name-input"
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
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                }
                hasError={!!errors.first_name}
                label="Nombre"
                placeholder="Ej: Juan"
                required
                {...register("first_name")}
              />
              {errors.first_name && (
                <p className="text-red-600 text-xs">
                  {errors.first_name.message}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-0.5">
              <FormInput
                autoComplete="family-name"
                data-testid="last-name-input"
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
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                }
                hasError={!!errors.last_name}
                label="Apellido"
                placeholder="Ej: Pérez"
                required
                {...register("last_name")}
              />
              {errors.last_name && (
                <p className="text-red-600 text-xs">
                  {errors.last_name.message}
                </p>
              )}
            </div>
          </div>
          <div className="animate-auth-field-2 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <div className="flex flex-col gap-0.5">
              <FormInput
                autoComplete="email"
                data-testid="email-input"
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
                type="email"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-red-600 text-xs">{errors.email.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-0.5">
              <Controller
                control={control}
                name="phone"
                render={({ field }) => (
                  <PhoneInput
                    hasError={!!errors.phone}
                    label="Celular (opcional)"
                    onChange={field.onChange}
                    placeholder="Ej: +54 9 11 1234-5678"
                    value={field.value ?? ""}
                  />
                )}
              />
              {errors.phone && (
                <p className="text-red-600 text-xs">{errors.phone.message}</p>
              )}
            </div>
          </div>
          <div className="animate-auth-field-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <div className="flex flex-col gap-0.5">
              <PasswordInput
                autoComplete="new-password"
                data-testid="password-input"
                hasError={!!errors.password}
                label="Contraseña"
                placeholder="Mínimo 8 caracteres"
                required
                {...register("password")}
              />
              {errors.password && (
                <p className="text-red-600 text-xs">
                  {errors.password.message}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-0.5">
              <PasswordInput
                autoComplete="new-password"
                data-testid="confirm-password-input"
                hasError={!!errors.confirm_password}
                label="Repetir contraseña"
                placeholder="Repetí la contraseña"
                required
                {...register("confirm_password")}
              />
              {errors.confirm_password && (
                <p className="text-red-600 text-xs">
                  {errors.confirm_password.message}
                </p>
              )}
            </div>
          </div>
          <ErrorMessage data-testid="register-error" error={error} />
          <p className="animate-auth-field-5 text-center text-[11px] font-medium leading-tight text-[var(--text-muted)] sm:text-xs">
            Al crear una cuenta aceptás la{" "}
            <LocalizedClientLink
              className="font-medium underline text-[var(--text-muted)]"
              href="/legal/legals"
            >
              Política de Privacidad
            </LocalizedClientLink>{" "}
            y los{" "}
            <LocalizedClientLink
              className="font-medium underline text-[var(--text-muted)]"
              href="/legal/conditions"
            >
              Términos y Condiciones
            </LocalizedClientLink>
            .
          </p>
          <button
            className="animate-auth-button mt-0.5 w-full min-h-[44px] rounded-xl bg-[--primary-color] px-4 py-2.5 font-semibold text-sm text-white transition-colors hover:bg-[--primary-color-dark] disabled:cursor-not-allowed disabled:opacity-50 sm:py-3 sm:text-base"
            data-testid="register-button"
            disabled={isLoading || !isValid}
            type="submit"
          >
            {isLoading ? "Procesando..." : "Registrarse"}
          </button>
        </form>
        {googleEnabled && (
          <div className="animate-auth-footer mt-3 w-full">
            <div className="mb-2.5 flex items-center gap-3">
              <span className="h-px flex-1 bg-gray-200" />
              <span className="text-xs text-gray-400">o</span>
              <span className="h-px flex-1 bg-gray-200" />
            </div>
            <button
              className="flex w-full min-h-[44px] items-center justify-center gap-3 rounded-xl border border-gray-300 bg-white px-4 py-2.5 font-medium text-sm text-[var(--text-dark)] transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 sm:py-3 sm:text-base"
              data-testid="google-register-button"
              disabled={isLoading}
              onClick={() => loginWithGoogle()}
              type="button"
            >
              <svg height="18" viewBox="0 0 24 24" width="18" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" fill="#34A853" />
                <path d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" fill="#EA4335" />
              </svg>
              Continuar con Google
            </button>
          </div>
        )}
        <p className="animate-auth-footer mt-3 text-center text-gray-500 text-sm">
          ¿Ya tenés cuenta?{" "}
          <button
            className="font-medium text-sm text-[--primary-color] hover:underline"
            onClick={() => setCurrentView(LOGIN_VIEW.SIGN_IN)}
            type="button"
          >
            Iniciá sesión
          </button>
        </p>
      </div>
    </>
  );
};

export default Register;
