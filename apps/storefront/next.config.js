const checkEnvVariables = require("./check-env-variables");

checkEnvVariables();

// Permite que next/image optimice las imágenes servidas por el backend de Medusa
// (banners, landing pages, etc. bajo /static/**). El dominio del backend cambia
// por entorno, así que lo derivamos del env en vez de hardcodearlo: sin un
// remotePattern que matchee, `/_next/image` responde 400 y la imagen no se ve
// (en local andaba solo porque `localhost` ya estaba en la lista).
const backendImagePattern = (() => {
  const raw = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL;
  if (!raw) return null;
  try {
    const { protocol, hostname, port } = new URL(raw);
    return {
      protocol: protocol.replace(":", ""),
      hostname,
      ...(port ? { port } : {}),
    };
  } catch {
    return null;
  }
})();

/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  reactStrictMode: true,
  /**
   * Skew protection: identifica el build en cada request de asset (`?dpl=<id>`), para
   * que una pestaña con el bundle de un deploy viejo pida SUS chunks y no los del
   * deploy nuevo (que tienen otro hash y dan 404 → `ChunkLoadError` → pantalla de
   * error en una navegación client-side).
   *
   * ⚠ La mitad de esto vive FUERA del repo: el `?dpl` sólo sirve de algo si Vercel
   * tiene **Skew Protection activado** en Project Settings → Advanced, que es lo que
   * hace que el edge rutee ese id al deployment correspondiente. Sin el toggle, el
   * parámetro se ignora y el asset viejo sigue dando 404.
   *
   * `VERCEL_DEPLOYMENT_ID` lo inyecta Vercel; `NEXT_DEPLOYMENT_ID` queda como escape
   * hatch para el resto de los entornos (build propio, DO, preview local).
   */
  deploymentId:
    process.env.NEXT_DEPLOYMENT_ID || process.env.VERCEL_DEPLOYMENT_ID || undefined,
  // Client-side Router Cache. Next.js defaults `staleTimes.dynamic` to 0, so
  // every navigation to a dynamic route does a full server round-trip with no
  // cache reuse — this is what made page changes feel slow after the Next 16
  // upgrade. Caching dynamic segments for 30s (and prefetched/static shells
  // for 3min) makes back/forward and revisits feel instant while still
  // refreshing reasonably often. Cart/wishlist UI is client-reactive (Zustand),
  // so a briefly cached server shell does not show stale cart state.
  experimental: {
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
    // El default de Server Actions es 1MB. Los uploads que pasan el archivo en
    // base64 (avatar del cliente, logo de empresa) inflan el body ~37%, así que
    // una imagen de 2MB viaja como ~2.7MB y reventaba el tope. 3mb da margen.
    // En Next 16 `serverActions` sigue bajo `experimental` (confirmado en docs).
    serverActions: {
      bodySizeLimit: "3mb",
    },
  },
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    qualities: [50, 75],
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
      },
      // Backend de Medusa (derivado de NEXT_PUBLIC_MEDUSA_BACKEND_URL) — sirve
      // las imágenes subidas desde el backoffice (banners, landings, etc.).
      ...(backendImagePattern ? [backendImagePattern] : []),
      // Fallback robusto: en producción el storefront y el backend viven bajo
      // *.minimalart.studio (ej: mercatto-backend.minimalart.studio/static/...).
      // Esto cubre las imágenes del backoffice aunque NEXT_PUBLIC_MEDUSA_BACKEND_URL
      // no esté disponible al hacer `next build` — la causa típica de los
      // banners/marcas "sin imagen" en prod, ya que sin pattern /_next/image da 400.
      {
        protocol: "https",
        hostname: "**.minimalart.studio",
      },
      // DigitalOcean Spaces (S3-compatible): destino real de los uploads del
      // backoffice cuando S3 está activo en prod (banners, logos de marcas,
      // thumbnails de productos, etc.). Sin este pattern, /_next/image da 400 y
      // las imágenes recién subidas se ven rotas aunque el origen responda 200.
      {
        protocol: "https",
        hostname: "**.digitaloceanspaces.com",
      },
      {
        protocol: "https",
        hostname: "medusa-public-images.s3.eu-west-1.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "medusa-server-testing.s3.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "medusa-server-testing.s3.us-east-1.amazonaws.com",
      },
      {
        protocol: 'https',
        hostname: 'mercatto-medusa.nyc3.cdn.digitaloceanspaces.com',
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "placehold.co",
      },
      // CDNs de las imágenes de productos seedeados (data de demo Carrefour/VTEX).
      // Wildcards para cubrir subdominios sin enumerarlos uno por uno.
      {
        protocol: "https",
        hostname: "**.vteximg.com.br",
      },
      {
        protocol: "https",
        hostname: "**.vtexassets.com",
      },
      {
        protocol: "https",
        hostname: "**.carrefour.com.ar",
      },
      // Demo Stores import product images from ARBITRARY external domains (the
      // source WooCommerce/VTEX/Shopify store, e.g. depotexpress.com.ar). We
      // can't enumerate those hosts, so allow any https/http image — otherwise
      // next/image returns 400 and product images (PDP gallery, related,
      // featured grids, cards) render broken. Optimization still applies.
      {
        protocol: "https",
        hostname: "**",
      },
      {
        protocol: "http",
        hostname: "**",
      },
    ],
  },
};

// Sentry es OPCIONAL: solo envolvemos la config cuando hay DSN. Sin DSN, el
// build queda idéntico al actual y no se carga nada de Sentry. La subida de
// sourcemaps ocurre únicamente si además están SENTRY_AUTH_TOKEN/ORG/PROJECT.
const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
// Kill-switch: NEXT_PUBLIC_SENTRY_ENABLED=false desactiva Sentry (local/develop)
// aunque haya DSN — no envuelve la config ni sube sourcemaps.
const SENTRY_ENABLED = process.env.NEXT_PUBLIC_SENTRY_ENABLED !== "false";

if (SENTRY_DSN && SENTRY_ENABLED) {
  const { withSentryConfig } = require("@sentry/nextjs");
  module.exports = withSentryConfig(nextConfig, {
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    authToken: process.env.SENTRY_AUTH_TOKEN,
    // Sin ruido en logs de build salvo en CI.
    silent: !process.env.CI,
    // No subir sourcemaps si falta el auth token (evita romper el build).
    sourcemaps: {
      disable: !process.env.SENTRY_AUTH_TOKEN,
    },
    // Oculta los sourcemaps del bundle cliente servido al browser.
    hideSourceMaps: true,
    // Tunnel opcional para esquivar ad-blockers (se activa por env).
    tunnelRoute: process.env.NEXT_PUBLIC_SENTRY_TUNNEL_ROUTE || undefined,
  });
} else {
  module.exports = nextConfig;
}
