"use client";

import ForgotPassword from "@modules/account/components/forgot-password";
import Login from "@modules/account/components/login";
import Register from "@modules/account/components/register";
import { useScrollLock } from "@lib/hooks/use-scroll-lock";
import { useDemoHref, useTenant, useTenantTheme } from "@lib/site-config/context";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export const LOGIN_VIEW = {
  SIGN_IN: "sign-in",
  REGISTER: "register",
  FORGOT_PASSWORD: "forgot-password",
} as const;

export type LOGIN_VIEW = (typeof LOGIN_VIEW)[keyof typeof LOGIN_VIEW];

type LoginTemplateProps = {
  /** A dónde redirigir tras login exitoso. Default: "/store". */
  redirectTo?: string;
  /** Subtítulo del formulario de ingreso. */
  subtitle?: string;
};

const LoginTemplate = ({ redirectTo, subtitle }: LoginTemplateProps = {}) => {
  const [currentView, setCurrentView] = useState<
    "sign-in" | "register" | "forgot-password"
  >("sign-in");
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const tenant = useTenant();
  const demoHref = useDemoHref();
  const { colors } = useTenantTheme();
  // Sports: fondo PRIMARIO pleno (sin degradé) y botón Volver plano (sin pill).
  const isSports = tenant.template === "sports";

  useEffect(() => {
    // Verificar si hay query param linked=true
    if (searchParams.get("linked") === "true") {
      setShowSuccessMessage(true);
      setCurrentView("sign-in");
      // Remover query param de la URL (conservando el prefijo del demo, si hay)
      router.replace(demoHref("/account"), { scroll: false });
      // Ocultar mensaje después de 5 segundos
      const timer = setTimeout(() => {
        setShowSuccessMessage(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [searchParams, router]);

  // Pantalla de login a página completa: bloqueamos el scroll del fondo.
  useScrollLock(true);

  const isRegisterView = currentView === "register";

  return (
    <section
      className={`fixed inset-0 z-[60] flex h-dvh w-full flex-col overflow-y-auto overflow-x-hidden md:overflow-y-hidden ${
        isSports
          ? ""
          : "bg-gradient-to-b from-[var(--auth-gradient-from)] to-[var(--auth-gradient-to)]"
      }`}
      style={isSports && colors?.primary ? { backgroundColor: colors.primary } : undefined}
    >
      {/* Botón Volver */}
      <div className="px-6 pt-4 sm:pt-5 md:absolute md:top-4 md:left-0 md:z-[65] md:pt-0">
        <LocalizedClientLink
          className={`group inline-flex items-center gap-2 font-semibold text-sm text-white transition-all duration-200 hover:gap-3 active:scale-95 ${
            isSports
              ? "hover:opacity-80"
              : "rounded-full px-3 py-1.5 hover:bg-white/15"
          }`}
          href="/"
        >
          <svg
            className="transition-transform duration-200 group-hover:-translate-x-0.5"
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

      {showSuccessMessage && (
        <div className="-translate-x-1/2 fixed top-4 left-1/2 z-[70] transform rounded-md border border-green-200 bg-green-50 px-4 py-3 shadow-lg">
          <p className="font-medium text-green-800 text-sm">
            ¡Cuenta vinculada exitosamente! Por favor inicia sesión.
          </p>
        </div>
      )}

      {/* Card centrada — `my-auto` centra verticalmente en todos los tamaños y,
          cuando el form es más alto que la pantalla, sigue siendo scrolleable
          (a diferencia de items-center, que recortaría el tope). */}
      <div className="flex flex-1 justify-center px-4 py-3 sm:py-4 md:py-3">
        <div
          className={`my-auto w-full transition-[max-width] duration-400 ease-in-out ${isRegisterView ? "max-w-[710px]" : "max-w-[480px]"}`}
        >
          <div
            className={`animate-auth-view rounded-2xl bg-white shadow-lg ${isRegisterView ? "px-4 py-5 sm:px-6 sm:py-6" : "px-5 py-8 sm:px-8 sm:py-10"}`}
            key={currentView}
          >
            {currentView === "sign-in" && (
              <Login
                setCurrentView={setCurrentView}
                redirectTo={redirectTo}
                subtitle={subtitle}
              />
            )}
            {currentView === "register" && (
              <Register setCurrentView={setCurrentView} />
            )}
            {currentView === "forgot-password" && (
              <ForgotPassword setCurrentView={setCurrentView} />
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default LoginTemplate;
