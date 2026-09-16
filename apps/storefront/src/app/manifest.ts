import { getPwaBrand } from "@lib/site-config/pwa";
import type { MetadataRoute } from "next";

/**
 * `manifest.webmanifest` del STOREFRONT, con los datos de la tienda activa.
 *
 * ─── QUÉ PASABA ──────────────────────────────────────────────────────────────
 *
 * El layout raíz declaraba `manifest: '/manifest.json'`, y ese archivo estático era
 * el manifest de la mini-app del REPARTIDOR: `"Mercatto Repartidores"`, ícono de
 * Mercatto y `start_url: "/driver"`. O sea que TODA página del storefront —de
 * cualquier tienda, en cualquier host— le ofrecía al comprador instalar
 * "Instalar Mercatto Repartidores", con el ícono de Mercatto y apuntando a la app de
 * reparto. Reportado sobre `vital.minimalart.studio/store`.
 *
 * ─── QUÉ HACE AHORA ──────────────────────────────────────────────────────────
 *
 * Resuelve el tenant como `generateMetadata()` del layout raíz, así el cartel de
 * instalación dice el nombre, la descripción, el color y el ícono de la tienda que se
 * está mirando. El manifest del repartidor volvió a donde corresponde:
 * `/driver/manifest.webmanifest`, servido sólo bajo `/driver` (el layout de esa
 * mini-app lo declara), así que ya no se le ofrece a un comprador.
 *
 * SIN `revalidate`, igual que `robots.ts` y `sitemap.ts`: leer el tenant vuelve
 * dinámica la ruta, que es lo que hace que cada host publique el suyo. Un manifest
 * cacheado por URL se serviría idéntico en todos los hosts (ver la nota de cache keys
 * bajo multi-host en `proxy.ts`).
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const brand = await getPwaBrand();

  // Bajo resolución por host el prefijo es `''` y la home es `/`; bajo
  // `/tienda/<slug>` la app instalada tiene que abrir la home de ESA tienda.
  const start = `${brand.prefix}/`;

  return {
    // `id` fija la identidad de la app instalada. Sin él, el id es el `start_url`, y
    // cambiarlo alguna vez haría que el browser trate la PWA como una app NUEVA en
    // vez de actualizar la instalada.
    id: start,
    name: brand.name,
    short_name: brand.shortName,
    description: brand.description,
    start_url: start,
    scope: start,
    display: "standalone",
    // Sin `orientation`: una tienda se navega igual en vertical y en horizontal, y
    // fijarla bloquea la rotación en la app instalada.
    lang: "es",
    dir: "ltr",
    categories: ["shopping"],
    theme_color: brand.themeColor,
    background_color: "#ffffff",
    icons: brand.icons,
  };
}
