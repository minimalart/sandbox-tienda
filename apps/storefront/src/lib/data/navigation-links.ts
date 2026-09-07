export type NavigationLink = {
  name: string;
  href: string;
  external?: boolean;
  target?: string;
};

export const COMPANY_LINKS: NavigationLink[] = [
  { name: "Tienda", href: "/store" },
  { name: "Recetas", href: "/blog" },
  { name: "Sucursales", href: "/sucursales" },
  { name: "Cuentas corporativas", href: "/corporate/register" },
  { name: "Contacto", href: "/contact" },
];

/**
 * Legales por defecto (Mercatto). Fallback cuando el tenant/demo no configura
 * sus propios legales (p.ej. las demos, cuyo template de footer no trae `legal`).
 * Reusado por el footer y el menú mobile.
 *
 * Los hrefs deben apuntar a rutas que existen bajo app/[countryCode]/(main)/legal:
 * `legals` (privacidad), `conditions` (términos) y `exchangesAndReturns` (cambios).
 * Dentro de una demo el proxy stripea el prefijo /demo/{slug} y reusa esas mismas
 * rutas, así que estos links funcionan igual en el sitio principal y en las demos.
 * Mantener en sync con los `footer.legal` de site-config (default/fashion/…).
 */
export const DEFAULT_LEGAL_LINKS: NavigationLink[] = [
  { name: "Política de privacidad", href: "/legal/legals" },
  { name: "Términos y condiciones", href: "/legal/conditions" },
  { name: "Cambios y devoluciones", href: "/legal/exchangesAndReturns" },
];
