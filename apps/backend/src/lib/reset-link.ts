/**
 * La base pública del storefront para armar el link de un reseteo de contraseña.
 *
 * Vive acá y no en cada subscriber porque `auth.password_reset` tiene DOS oyentes —el
 * de mail y el de WhatsApp— que le mandan al mismo cliente el mismo link. Con la
 * lógica duplicada, arreglar uno y olvidarse del otro deja al cliente eligiendo entre
 * dos URLs distintas para la misma acción, y el que no anda no avisa: la página existe
 * en los dos dominios.
 */

/** El `origin` de una URL absoluta http(s), o `null` si no lo es. */
export function toOrigin(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.origin;
  } catch {
    return null;
  }
}

/** La base por defecto: la env var de la instalación. */
export function defaultStorefrontUrl(): string {
  const fromEnv =
    process.env.STOREFRONT_URL ||
    (process.env.STORE_CORS || '').split(',')[0] ||
    'http://localhost:3000';
  return fromEnv.replace(/\/+$/, '');
}

/** Los orígenes que esta instalación reconoce como storefront propio. */
export function allowedStorefrontOrigins(): string[] {
  return [process.env.STOREFRONT_URL ?? '', ...(process.env.STORE_CORS ?? '').split(',')]
    .map((value) => toOrigin(value))
    .filter((value): value is string => value !== null);
}

/**
 * La base del link: la que declaró el storefront que originó el pedido, si es una de
 * las nuestras; si no, la env var.
 *
 * EL ALLOWLIST NO ES OPCIONAL. `web_url` sale del header `Origin` del browser
 * (`apps/storefront/src/app/api/store/auth/route.ts`), o sea que lo elige QUIEN PIDE
 * el reseteo, no nosotros. Sin filtrar, cualquiera pide un reset para la casilla de
 * otro con un `Origin` propio y nosotros le mandamos a la víctima —desde nuestro
 * remitente y con nuestra marca— un link a su dominio con el token adentro. Es host
 * header injection de manual, y el mail lo firma la tienda.
 *
 * Se compara por ORIGIN y no por prefijo de string: `https://tienda.com.evil` empieza
 * con `https://tienda.com` y pasaría un `startsWith`.
 *
 * `onReject` existe porque descartar en silencio deja EXACTAMENTE el síntoma del bug
 * que esto arregla: un link al dominio equivocado y nada en el log que lo explique.
 */
export function resolveStorefrontBase(
  webUrl: unknown,
  onReject?: (message: string) => void,
): string {
  const fallback = defaultStorefrontUrl();
  if (typeof webUrl !== 'string' || !webUrl) return fallback;

  const candidate = toOrigin(webUrl);
  if (candidate && allowedStorefrontOrigins().includes(candidate)) return candidate;

  onReject?.(
    `origen "${webUrl}" descartado: no está en STOREFRONT_URL ni en STORE_CORS. ` +
      `El link se arma con ${fallback}. Si es una tienda legítima, agregá su dominio ` +
      'a STORE_CORS.',
  );
  return fallback;
}

/** El link de reseteo completo, tal como lo abre el cliente. */
export function buildResetLink(base: string, token: string, email: string): string {
  return `${base}/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(
    email,
  )}`;
}
