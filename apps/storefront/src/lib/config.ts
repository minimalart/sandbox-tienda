import Medusa from "@medusajs/js-sdk";
import { getTenant } from "@lib/site-config/resolver";

// Defaults to standard port for Medusa server
let NEXT_PUBLIC_MEDUSA_BACKEND_URL = "http://localhost:9000";

if (process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL) {
  NEXT_PUBLIC_MEDUSA_BACKEND_URL = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL;
}

// SDK por defecto (para compatibilidad hacia atrás)
export const sdk = new Medusa({
  baseUrl: NEXT_PUBLIC_MEDUSA_BACKEND_URL,
  debug: process.env.NODE_ENV === "development",
  publishableKey: process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY,
});

/**
 * Obtiene un SDK de Medusa autenticado con la API key de admin (server-only)
 * Usar solo en API routes / server components
 */
export function getAdminSDK() {
  return new Medusa({
    baseUrl: NEXT_PUBLIC_MEDUSA_BACKEND_URL,
    debug: process.env.NODE_ENV === "development",
    apiKey: process.env.MEDUSA_ADMIN_API_KEY,
  });
}

/**
 * Obtiene el SDK de Medusa configurado con el tenant actual
 * Cacheable: usa getTenant() que está cacheado
 */
export async function getMedusaSDK() {
  const tenant = await getTenant();
  const publishableKey =
    tenant.medusa.publishableKey ||
    process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY;

  return new Medusa({
    baseUrl: NEXT_PUBLIC_MEDUSA_BACKEND_URL,
    debug: process.env.NODE_ENV === "development",
    publishableKey,
  });
}
