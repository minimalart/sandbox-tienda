/**
 * Layout raíz de la mini-app del driver.
 *
 * - Sin nav/footer del storefront principal
 * - Registra el Service Worker (scope /driver)
 * - El guard de autenticación lo hace cada page/layout anidado que necesite
 *   sesión (no acá porque /driver/login no necesita token)
 */

import { getPwaBrand } from "@lib/site-config/pwa";
import type { Metadata, Viewport } from "next";
import Script from "next/script";

/**
 * Marca de la TIENDA, no la constante del boilerplate.
 *
 * Estaba escrito "Mercatto Repartidores" a mano, así que el repartidor de cualquier
 * tienda instalaba y abría una app que decía Mercatto. Sale del mismo tenant que el
 * resto del sitio.
 *
 * `manifest` apunta al de esta mini-app (`/driver/manifest.webmanifest`) y pisa el del
 * storefront que emite `app/manifest.ts`: la metadata anidada gana sobre la del
 * segmento raíz, así que bajo `/driver` se linkea uno solo, el del repartidor.
 */
export async function generateMetadata(): Promise<Metadata> {
  const { name } = await getPwaBrand();
  const title = `${name} Repartidores`;

  return {
    title: { default: title, template: "%s | Repartidores" },
    description: "App de gestión de paradas para repartidores",
    manifest: "/driver/manifest.webmanifest",
    applicationName: title,
    robots: { index: false, follow: false },
  };
}

// Pinta la UI del navegador con el color primario de la tienda, igual que el layout
// raíz. Estaba fijo en el verde de Mercatto.
export async function generateViewport(): Promise<Viewport> {
  const { themeColor } = await getPwaBrand();

  return {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
    themeColor,
  };
}

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Registro del SW scopeado a /driver — solo carga en esta mini-app */}
      <Script id="driver-sw-register" strategy="afterInteractive">
        {`
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker
                .register('/sw.js', { scope: '/driver/' })
                .catch(function(err) {
                  console.warn('[driver SW]', err);
                });
            });
          }
        `}
      </Script>
      <div className="min-h-screen bg-gray-50 font-[var(--font-inter)]">
        {children}
      </div>
    </>
  );
}
