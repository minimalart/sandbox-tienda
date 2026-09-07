"use client";

import ErrorMessage from "@modules/checkout/components/error-message";
import PasswordInput from "@modules/common/components/password-input";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import { useTenantBrand } from "@lib/site-config/context";
import { useState } from "react";

type Props = {
  email: string;
  success: boolean;
  error: string | null;
  isLoading: boolean;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
};

const ResetPasswordTemplate = ({
  email,
  success,
  error,
  isLoading,
  onSubmit,
}: Props) => {
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const { logos, name: brandName } = useTenantBrand();
  const logoSrc = logos?.main || "/logo.webp";

  const isFormValid =
    password.length >= 8 &&
    confirmPassword.length >= 8 &&
    password === confirmPassword;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPasswordError(null);

    const formData = new FormData(e.currentTarget);
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirm_password") as string;

    if (password !== confirmPassword) {
      setPasswordError("Las contraseñas no coinciden");
      return;
    }

    onSubmit(e);
  };

  const content = success ? (
    <div
      className="flex w-full flex-col items-center"
      data-testid="reset-password-success"
    >
      <div className="animate-auth-logo mb-4 flex justify-center">
        {/* biome-ignore lint/a11y/useAltText: alt provisto */}
        <img alt={brandName} className="h-10 w-auto object-contain" src={logoSrc} />
      </div>
      <h1 className="animate-auth-title mb-2 text-center text-[32px] font-bold leading-tight text-[var(--text-dark)]">
        Contraseña actualizada
      </h1>
      <p className="animate-auth-subtitle mb-6 text-center text-sm font-normal text-[var(--text-muted)]">
        Tu contraseña se restableció correctamente. Ya podés iniciar sesión con
        tu nueva contraseña.
      </p>
      <LocalizedClientLink
        href="/account"
        className="animate-auth-button block w-full min-h-[44px] rounded-xl bg-[--primary-color] px-4 py-3 text-center font-semibold text-base text-white transition-colors hover:bg-[--primary-color-dark]"
      >
        Iniciar sesión
      </LocalizedClientLink>
    </div>
  ) : (
    <div
      className="flex w-full flex-col items-center"
      data-testid="reset-password-page"
    >
      <div className="animate-auth-logo mb-4 flex justify-center">
        {/* biome-ignore lint/a11y/useAltText: alt provisto */}
        <img alt={brandName} className="h-10 w-auto object-contain" src={logoSrc} />
      </div>
      <h1 className="animate-auth-title mb-2 text-center text-[32px] font-bold leading-tight text-[var(--text-dark)]">
        Nueva contraseña
      </h1>
      <p className="animate-auth-subtitle mb-6 text-center text-sm font-normal text-[var(--text-muted)]">
        Ingresá tu nueva contraseña para este correo:{" "}
        <span className="font-medium text-gray-900">{email}</span>
      </p>
      <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3">
        <div className="animate-auth-field-1">
        <PasswordInput
          autoComplete="new-password"
          data-testid="new-password-input"
          hasError={!!passwordError}
          label="Nueva contraseña"
          minLength={8}
          name="password"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setPassword(e.target.value)
          }
          placeholder="Mínimo 8 caracteres"
          required
          title="Mínimo 8 caracteres"
          value={password}
        />
        </div>
        <div className="animate-auth-field-2 flex flex-col gap-1">
          <PasswordInput
            autoComplete="new-password"
            data-testid="confirm-password-input"
            hasError={!!passwordError}
            label="Confirmar contraseña"
            minLength={8}
            name="confirm_password"
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setConfirmPassword(e.target.value)
            }
            placeholder="Repetí la nueva contraseña"
            required
            value={confirmPassword}
          />
          {passwordError && (
            <p className="text-xs text-red-600">{passwordError}</p>
          )}
        </div>
        <ErrorMessage data-testid="reset-error-message" error={error} />
        <button
          type="submit"
          disabled={isLoading || !isFormValid}
          className="animate-auth-button mt-1 w-full min-h-[44px] rounded-xl bg-[--primary-color] px-4 py-3 font-semibold text-base text-white transition-colors hover:bg-[--primary-color-dark] disabled:cursor-not-allowed disabled:opacity-50"
          data-testid="reset-password-button"
        >
          {isLoading ? "Guardando..." : "Restablecer contraseña"}
        </button>
      </form>
      <p className="animate-auth-footer mt-4 text-center text-gray-500 text-sm">
        <LocalizedClientLink
          href="/account"
          className="font-medium text-sm text-[--primary-color] underline"
        >
          Volver al inicio de sesión
        </LocalizedClientLink>
      </p>
    </div>
  );

  return (
    <section className="fixed inset-0 z-[60] flex min-h-screen w-full flex-col overflow-auto bg-gradient-to-b from-[var(--auth-gradient-from)] to-[var(--auth-gradient-to)]">
      {/* Botón Volver */}
      <div className="px-6 pt-6">
        <LocalizedClientLink
          href="/"
          className="inline-flex items-center gap-2 font-semibold text-sm text-white transition-opacity hover:opacity-80"
        >
          <svg
            fill="none"
            height="20"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            width="20"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Volver
        </LocalizedClientLink>
      </div>

      {/* Card centrada */}
      <div className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-[480px]">
          <div className="animate-auth-view rounded-2xl bg-white px-5 py-8 shadow-lg sm:px-8 sm:py-10">
            {content}
          </div>
        </div>
      </div>
    </section>
  );
};

export default ResetPasswordTemplate;
