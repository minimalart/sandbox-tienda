"use client";

import { useWishlistStore } from "@lib/stores/wishlist.store";
import { useCallback, useState } from "react";
import { browserCustomerSession } from "@lib/util/customer-session";
import { siteHomeFromPathname } from "@lib/site-config/site-path";
import { getUtmParams } from "@lib/util/utm";

// ============================================================================
// TIPOS
// ============================================================================

export interface UseAuthState {
  isLoading: boolean;
  error: string | null;
}

export interface UseAuthActions {
  login: (email: string, password: string, options?: { salesChannelId?: string; countryCode?: string }) => Promise<LoginResult>;
  loginWithGoogle: () => Promise<{ success: boolean; message?: string }>;
  completeGoogleLogin: (query: Record<string, string>) => Promise<LoginResult>;
  signup: (data: SignupData) => Promise<SignupResult>;
  linkTenant: (
    email: string,
    password: string,
    tenantId: string,
  ) => Promise<{ success: boolean; message?: string }>;
  requestResetPassword: (
    email: string,
    options: { salesChannelId: string; countryCode: string },
  ) => Promise<{ success: boolean; message?: string }>;
  resetPassword: (
    email: string,
    password: string,
    token: string,
  ) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<boolean>;
  clearError: () => void;
}

export interface LoginResult {
  success: boolean;
  customer?: any;
  tenantMismatch?: boolean;
  originalTenant?: string;
  needsMigrationReset?: boolean;
  redirectTo?: string;
  message?: string;
}

export interface SignupResult {
  success: boolean;
  customer?: any;
  message?: string;
  emailExistsInOtherTenant?: boolean;
  originalTenant?: string;
}

export interface SignupData {
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
}

export type UseAuthReturn = UseAuthState & UseAuthActions;

// ============================================================================
// API HELPERS
// ============================================================================

const authApi = {
  async post<T = any>(
    action: string,
    data: Record<string, any> = {},
  ): Promise<T> {
    const response = await fetch("/api/store/auth", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-storefront-page": action === "googleCallback"
          ? sessionStorage.getItem("mercatto_oauth_path") || window.location.pathname
          : window.location.pathname,
      },
      body: JSON.stringify({ action, ...data }),
    });
    return response.json();
  },
};

// ============================================================================
// ERROR TRANSLATION
// ============================================================================

function translateAuthError(message?: string): string {
  if (!message) return "Ocurrió un error. Intentá de nuevo.";

  const errorMap: Record<string, string> = {
    "Identity with email already exists":
      "Este correo electrónico ya está registrado.",
    "Invalid email or password": "Correo electrónico o contraseña incorrectos.",
    Unauthorized: "No autorizado. Por favor, iniciá sesión nuevamente.",
    "Email o contraseña incorrectos":
      "Correo electrónico o contraseña incorrectos.",
    "Email y contraseña son requeridos":
      "Ingresá tu correo electrónico y contraseña.",
  };

  // Buscar coincidencia parcial
  for (const [key, translation] of Object.entries(errorMap)) {
    if (message.toLowerCase().includes(key.toLowerCase())) {
      return translation;
    }
  }

  return "Ocurrió un error al iniciar sesión. Intentá de nuevo.";
}

// ============================================================================
// COOKIE HELPERS
// ============================================================================

// ============================================================================
// HOOK
// ============================================================================

export function useAuth(): UseAuthReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(
    async (email: string, password: string, options?: { salesChannelId?: string; countryCode?: string }): Promise<LoginResult> => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await authApi.post<LoginResult>("login", {
          email,
          password,
          ...(options?.salesChannelId && { sales_channel_id: options.salesChannelId }),
          ...(options?.countryCode && { country_code: options.countryCode }),
        });

        if (!result.success) {
          if (!result.tenantMismatch) {
            setError(translateAuthError(result.message));
          }
          return result;
        }

        if (result.customer && browserCustomerSession().mode === 'b2c') {
          await useWishlistStore.getState().syncGuestWishlist();
        }

        return result;
      } catch (err) {
        const message = "Error de conexión. Intentá de nuevo.";
        setError(message);
        return { success: false, message };
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  // Inicia el flujo OAuth a través del API route del storefront (mismo origen):
  // el servidor le pide a Medusa la URL de Google y nosotros redirigimos el
  // navegador. Así NO hay llamada cross-origin del browser al backend (sin CORS),
  // igual que el login con email. El callback_url se arma desde el origin real
  // para que funcione en cualquier entorno (no depende de un env hardcodeado).
  // OJO: las URLs visibles del storefront NO llevan prefijo de país (el folder
  // [countryCode] es interno y el middleware redirige /ar/... a la versión
  // limpia, perdiendo el query string). Por eso el callback es /google-callback
  // sin segmento de país — ese es el redirect_uri que va a Google Console.
  const loginWithGoogle = useCallback(async (): Promise<{
    success: boolean;
    message?: string;
  }> => {
    setIsLoading(true);
    setError(null);

    try {
      const callbackUrl = `${window.location.origin}/google-callback`;
      sessionStorage.setItem("mercatto_oauth_path", window.location.pathname);

      const result = await authApi.post<{
        success: boolean;
        location?: string;
        message?: string;
      }>("googleInit", { callbackUrl });

      if (result.success && result.location) {
        // Redirigir a la pantalla de consentimiento de Google
        window.location.href = result.location;
        return { success: true };
      }

      const message = result.message || "No se pudo iniciar el login con Google.";
      setError(message);
      return { success: false, message };
    } catch (err) {
      const message = "No se pudo conectar con Google. Intentá de nuevo.";
      setError(message);
      return { success: false, message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Cierra el flujo OAuth: reenvía los query params (code/state) de Google al
  // API route, que server-side intercambia el código por token y aplica la
  // validación multi-tenant. Mantiene paridad con login() (cookie + wishlist).
  const completeGoogleLogin = useCallback(
    async (query: Record<string, string>): Promise<LoginResult> => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await authApi.post<LoginResult>("googleCallback", {
          query,
        });

        if (!result.success) {
          if (!result.tenantMismatch) {
            setError(translateAuthError(result.message));
          }
          return result;
        }

        const sourcePath = sessionStorage.getItem("mercatto_oauth_path");
        const home = siteHomeFromPathname(sourcePath || "/");
        sessionStorage.removeItem("mercatto_oauth_path");
        // The callback keeps the registered URL; restore this tab's original shop.
        return { ...result, redirectTo: `${home === "/" ? "" : home}/store` };

      } catch (err) {
        const message = "Error de conexión. Intentá de nuevo.";
        setError(message);
        return { success: false, message };
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const signup = useCallback(
    async (data: SignupData): Promise<SignupResult> => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await authApi.post<SignupResult>("signup", {
          ...data,
          utm: getUtmParams(),
        });

        if (result.success) {
          if (browserCustomerSession().mode === 'b2c') await useWishlistStore.getState().syncGuestWishlist();
        } else {
          // Si es el error especial de email en otro tenant, no mostrar error genérico
          if (result.emailExistsInOtherTenant) {
            // No establecer error aquí, dejar que el componente maneje el flujo
            return result;
          }
          // Traducir mensajes de error comunes
          const errorMessage = translateAuthError(result.message);
          setError(errorMessage);
        }

        return result;
      } catch (err) {
        const message = "Error de conexión. Intentá de nuevo.";
        setError(message);
        return { success: false, message };
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const linkTenant = useCallback(
    async (
      email: string,
      password: string,
      tenantId: string,
    ): Promise<{ success: boolean; message?: string }> => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await authApi.post<{
          success: boolean;
          message?: string;
        }>("linkTenant", {
          email,
          password,
          tenantId,
        });

        if (!result.success) {
          setError(result.message || "Error al vincular la cuenta");
        }

        return result;
      } catch (err) {
        const message = "Error de conexión. Intentá de nuevo.";
        setError(message);
        return { success: false, message };
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const requestResetPassword = useCallback(
    async (
      email: string,
      options: { salesChannelId: string; countryCode: string },
    ): Promise<{ success: boolean; message?: string }> => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await authApi.post<{
          success: boolean;
          message?: string;
        }>("requestResetPassword", {
          email: email.trim(),
          sales_channel_id: options.salesChannelId,
          country_code: options.countryCode,
        });
        return result;
      } catch (err) {
        const message = "Error de conexión. Intentá de nuevo.";
        setError(message);
        return { success: false, message };
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const resetPassword = useCallback(
    async (
      email: string,
      password: string,
      token: string,
    ): Promise<{ success: boolean; message?: string }> => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await authApi.post<{
          success: boolean;
          message?: string;
        }>("resetPassword", {
          email,
          password,
          token,
        });
        if (!result.success) {
          setError(result.message || "No se pudo restablecer la contraseña.");
        }
        return result;
      } catch (err) {
        const message = "Error de conexión. Intentá de nuevo.";
        setError(message);
        return { success: false, message };
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const logout = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authApi.post("signout");
      if (response.success !== false && browserCustomerSession().mode === 'b2c') useWishlistStore.getState().reset();
      return response.success !== false;
    } catch (err) {
      setError('No se pudo cerrar la sesión. Intentá de nuevo.');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    isLoading,
    error,
    login,
    loginWithGoogle,
    completeGoogleLogin,
    signup,
    linkTenant,
    requestResetPassword,
    resetPassword,
    logout,
    clearError,
  };
}
