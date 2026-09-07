"use client";

import { useChannel } from "@lib/context/channel-context";
import { useTenantBrand } from "@lib/site-config/context";
import { useAuth } from "@lib/hooks/use-auth";
import { type LoginInput, loginSchema } from "@lib/validation/auth";
import { LOGIN_VIEW } from "@modules/account/templates/login-template";
import ErrorMessage from "@modules/checkout/components/error-message";
import CheckboxInput from "@modules/common/components/checkbox-input";
import FormInput from "@modules/common/components/form-input";
import PasswordInput from "@modules/common/components/password-input";
import { zodResolver } from "@lib/util/zod-resolver";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

type Props = {
  setCurrentView: (view: LOGIN_VIEW) => void;
  /** A dónde redirigir tras login exitoso. Default: "/store". */
  redirectTo?: string;
  /** Subtítulo bajo el logo. Default: copy B2C. */
  subtitle?: string;
};

// Mapa de tenant IDs a nombres amigables
const TENANT_NAMES: Record<string, string> = {
  sheru: "Sheru",
  freshpop: "Freshpop",
  aromapop: "Aromapop",
};

const REMEMBER_KEY = "mercatto_remember_me";

const Login = ({ setCurrentView, redirectTo = "/store", subtitle }: Props) => {
  const [migrationResetSent, setMigrationResetSent] = useState(false);
  const [tenantMismatch, setTenantMismatch] = useState<{
    isMismatch: boolean;
    tenantName: string;
  } | null>(null);
  const [rememberMe, setRememberMe] = useState(false);
  const { countryCode } = useParams() as { countryCode: string };
  const { login, loginWithGoogle, isLoading, error } = useAuth();
  const { config } = useChannel();
  const { logos, name: brandName } = useTenantBrand();

  // El botón de Google se muestra solo si el proyecto activó la integración.
  const googleEnabled =
    process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true";

  const {
    register,
    handleSubmit,
    reset,
    trigger,
    formState: { errors, isValid },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    mode: "onChange",
    defaultValues: { email: "", password: "" },
  });

  useEffect(() => {
    try {
      const stored = localStorage.getItem(REMEMBER_KEY);
      if (stored) {
        const { email, password } = JSON.parse(stored);
        if (email || password) {
          reset({ email: email || "", password: password || "" });
          setRememberMe(true);
          trigger();
        }
      }
    } catch {}
  }, [reset, trigger]);

  const onSubmit = async ({ email, password }: LoginInput) => {
    setTenantMismatch(null);

    if (rememberMe) {
      localStorage.setItem(REMEMBER_KEY, JSON.stringify({ email, password }));
    } else {
      localStorage.removeItem(REMEMBER_KEY);
    }

    const result = await login(email, password, {
      salesChannelId: config.salesChannelId,
      countryCode,
    });

    if (result.success) {
      window.location.href = redirectTo;
    } else if (result.needsMigrationReset) {
      setMigrationResetSent(true);
    } else if (result.tenantMismatch) {
      const tenantName =
        TENANT_NAMES[result.originalTenant ?? ""] ||
        result.originalTenant ||
        "";
      setTenantMismatch({
        isMismatch: true,
        tenantName,
      });
    }
  };

  return (
    <div className="flex w-full flex-col items-center" data-testid="login-page">
      <div className="animate-auth-logo mb-4 flex justify-center">
        {/* biome-ignore lint/a11y/useAltText: alt provisto */}
        <img
          alt={brandName}
          className="h-10 w-auto object-contain"
          src={logos?.main || "/logos-mercatto/logocompleto-verde.svg"}
        />
      </div>
      {/* La pantalla de ingreso no tenía ningún encabezado: el título visual es el logo
          (una imagen) y un <p>. Oculto para no cambiar el diseño. */}
      <h1 className="sr-only">Iniciá sesión en {brandName}</h1>
      <p className="animate-auth-subtitle mb-6 text-center text-sm font-normal text-[var(--text-muted)]">
        {subtitle ?? "Iniciá sesión para gestionar pedidos y favoritos."}
      </p>
      <form
        className="flex w-full flex-col gap-3"
        noValidate
        onSubmit={handleSubmit(onSubmit)}
      >
        <div className="animate-auth-field-1">
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
            title="Ingresá un correo electrónico válido"
            type="email"
            {...register("email")}
          />
          {errors.email && (
            <p className="mt-1 text-red-600 text-xs">{errors.email.message}</p>
          )}
        </div>
        <div className="animate-auth-field-2">
          <PasswordInput
            autoComplete="current-password"
            data-testid="password-input"
            hasError={!!errors.password}
            label="Contraseña"
            placeholder="Mínimo 8 caracteres"
            required
            {...register("password")}
          />
          {errors.password && (
            <p className="mt-1 text-red-600 text-xs">
              {errors.password.message}
            </p>
          )}
        </div>
        {migrationResetSent ? (
          <div className="rounded-md bg-green-50 p-3 text-green-800 text-sm">
            <p className="font-medium">Creá tu contraseña</p>
            <p className="mt-1">
              Te enviamos un correo electrónico con instrucciones para crear tu contraseña.
              Revisá tu casilla de entrada (y spam).
            </p>
          </div>
        ) : tenantMismatch?.isMismatch ? (
          <div className="rounded-md bg-amber-50 p-3 text-amber-800 text-sm">
            <p className="font-medium">Cuenta registrada en otra tienda</p>
            <p className="mt-1">
              Este correo electrónico está registrado en {tenantMismatch.tenantName}. Por
              favor usá un correo electrónico diferente o visitá la tienda correcta.
            </p>
          </div>
        ) : (
          <ErrorMessage data-testid="login-error-message" error={error} />
        )}
        <div className="animate-auth-field-3 flex items-center justify-between">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--social-icon-color)]">
            <CheckboxInput
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            Recordarme
          </label>
          <button
            className="text-xs text-[var(--social-icon-color)] hover:underline"
            data-testid="forgot-password-link"
            onClick={() => setCurrentView(LOGIN_VIEW.FORGOT_PASSWORD)}
            type="button"
          >
            ¿Olvidaste tu contraseña?
          </button>
        </div>
        <button
          className="animate-auth-button mt-1 w-full min-h-[44px] rounded-xl bg-[--primary-color] px-4 py-3 font-semibold text-base text-white transition-colors hover:bg-[--primary-color-dark] disabled:cursor-not-allowed disabled:opacity-50"
          data-testid="sign-in-button"
          disabled={isLoading || !isValid}
          type="submit"
        >
          {isLoading ? "Procesando..." : "Ingresar"}
        </button>
      </form>
      {googleEnabled && (
        <div className="animate-auth-footer mt-4 w-full">
          <div className="mb-3 flex items-center gap-3">
            <span className="h-px flex-1 bg-gray-200" />
            <span className="text-xs text-gray-400">o</span>
            <span className="h-px flex-1 bg-gray-200" />
          </div>
          <button
            className="flex w-full min-h-[44px] items-center justify-center gap-3 rounded-xl border border-gray-300 bg-white px-4 py-3 font-medium text-base text-[var(--text-dark)] transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            data-testid="google-login-button"
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
      <p className="animate-auth-footer mt-4 text-center text-gray-500 text-sm">
        ¿Aún no tenés cuenta?{" "}
        <button
          className="font-medium text-sm text-[--primary-color] underline"
          data-testid="register-button"
          onClick={() => setCurrentView(LOGIN_VIEW.REGISTER)}
          type="button"
        >
          Registrate
        </button>
      </p>
    </div>
  );
};

export default Login;
