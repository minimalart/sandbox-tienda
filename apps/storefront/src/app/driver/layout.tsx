/**
 * Layout raíz de la mini-app del driver.
 *
 * - Sin nav/footer del storefront principal
 * - Registra el Service Worker (scope /driver)
 * - El guard de autenticación lo hace cada page/layout anidado que necesite
 *   sesión (no acá porque /driver/login no necesita token)
 */

import type { Metadata, Viewport } from "next";
import Script from "next/script";

export const metadata: Metadata = {
  title: {
    default: "Mercatto Repartidores",
    template: "%s | Repartidores",
  },
  description: "App de gestión de paradas para repartidores",
  manifest: "/manifest.json",
  applicationName: "Mercatto Repartidores",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#2e7d32",
};

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
