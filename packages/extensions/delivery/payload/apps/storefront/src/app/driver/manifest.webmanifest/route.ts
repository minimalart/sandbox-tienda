import { getPwaBrand } from "@lib/site-config/pwa";

/**
 * Manifest de la mini-app del REPARTIDOR, con la marca de la tienda activa.
 *
 * Antes era `public/manifest.json`: un archivo estático que decía "Mercatto
 * Repartidores" en toda instalación —también en la de una tienda que no es
 * Mercatto— y que, por estar declarado en el layout RAÍZ, el storefront le ofrecía
 * instalar a los compradores. Ahora vive acá adentro de `/driver`, lo declara sólo el
 * layout del repartidor, y el nombre sale del tenant.
 *
 * POR QUÉ UN ROUTE HANDLER Y NO LA CONVENCIÓN `manifest.ts`: Next sólo admite
 * `app/manifest.ts` en la RAÍZ del App Router, y ese lugar ya lo ocupa el manifest
 * del storefront. La extensión de la URL importa: `proxy.ts` deja pasar sin reescribir
 * todo path que tenga un punto, así que `/driver/manifest.webmanifest` llega derecho
 * acá con los headers de identidad de sitio ya puestos.
 */
export async function GET(): Promise<Response> {
  const brand = await getPwaBrand();

  const manifest = {
    id: "/driver",
    name: `${brand.name} Repartidores`,
    short_name: "Repartidores",
    description: `App de gestión de paradas para repartidores de ${brand.name}`,
    start_url: "/driver",
    scope: "/driver",
    display: "standalone",
    // Acá sí se fija: la app del repartidor se usa con una mano, en la calle.
    orientation: "portrait",
    lang: "es",
    dir: "ltr",
    theme_color: brand.themeColor,
    background_color: "#f9fafb",
    icons: brand.icons,
  };

  return new Response(JSON.stringify(manifest), {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      // Depende del tenant: no lo puede cachear un CDN que keyea sólo por URL.
      "Cache-Control": "no-store",
    },
  });
}
