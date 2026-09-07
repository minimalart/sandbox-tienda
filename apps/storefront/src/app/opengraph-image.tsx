import { getActiveTenant } from '@lib/site-config/active-tenant'
import { ImageResponse } from 'next/og'

// Site-wide Open Graph / social card. Next.js picks this up automatically and
// emits the og:image meta tag (twitter-image.tsx re-exports it for Twitter).

/**
 * SIN MARCA, a propósito.
 *
 * Acá decía `'Mercatto — Tienda online'`, y de ahí salían el `og:image:alt` y el
 * `twitter:image:alt` de TODAS las tiendas: desdeelsur publicaba
 * `<meta property="og:image:alt" content="Mercatto — Tienda online">` en cada página.
 *
 * No se puede resolver el tenant acá: Next exige que `alt` sea una exportación
 * ESTÁTICA (se lee sin ejecutar la ruta). La alternativa sería `generateImageMetadata`,
 * que sí es async — pero le agrega un segmento de `id` a la URL de la imagen, o sea
 * cambia la URL de la card de todo proyecto generado. No vale el cambio por un `alt`.
 *
 * Genérico y verdadero para cualquier tienda le gana a específico y ajeno. La marca
 * real se lee igual: va DIBUJADA dentro de la imagen, resuelta abajo.
 */
export const alt = 'Tienda online'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/**
 * Último recurso si el tenant no resuelve: neutro, nunca una marca.
 *
 * Un fallback con nombre propio no degrada, IMPERSONA — le pone la marca de otra
 * tienda a la card de esta. Es la misma regla que ya rige en el footer: un dato de
 * negocio que no está no se inventa.
 */
const FALLBACK = {
  name: 'Tienda online',
  description: 'Tu tienda online para todo lo que necesitás, al mejor precio.',
  primary: '#2E7D32',
}

export default async function OpengraphImage() {
  /**
   * `getActiveTenant()`, no `getTenant()`.
   *
   * `getTenant()` es el resolver ESTÁTICO (`defaultConfig`, `name: "Mercatto"`), así
   * que la card salía con la marca del boilerplate dibujada adentro.
   *
   * Esta ruta está EXCLUIDA del matcher del proxy y nunca recibe `x-site-slug`, pero
   * `getActiveSiteSlug()` tiene el fallback por `Host` puesto para exactamente este
   * caso (ver `active-tenant.ts`). Fuera de request scope el `catch` cubre.
   */
  let name = FALLBACK.name
  let description = FALLBACK.description
  let primary = FALLBACK.primary
  try {
    const tenant = await getActiveTenant()
    name = tenant.name || tenant.metadata?.name || name
    description = tenant.metadata?.seo?.description || description
    primary = tenant.theme?.colors?.primary || primary
  } catch {
    // keep fallbacks
  }

  /**
   * Imagen propia cargada en el admin (SEO & GEO → Open Graph).
   *
   * Se sirve DESDE ACÁ y no como `openGraph.images` del metadata porque esta ruta es
   * una convención de archivo de Next: existe, así que le gana al metadata igual.
   * Declararla en los dos lados emitiría dos `og:image`, y las redes toman la
   * primera — la generada. Con la imagen adentro de la respuesta hay una sola URL,
   * el tamaño sigue siendo 1200×630 y el `content-type` no cambia.
   *
   * `objectFit: cover` porque el operador sube lo que tiene: una imagen con otra
   * relación de aspecto se recorta centrada en vez de deformarse.
   */
  const { getOpenGraphConfig } = await import('@lib/data/open-graph')
  const og = await getOpenGraphConfig()
  if (og?.image_url) {
    return new ImageResponse(
      (
        <div style={{ display: 'flex', width: '100%', height: '100%' }}>
          <img
            src={og.image_url}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
      ),
      { ...size }
    )
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '90px',
          background: `linear-gradient(135deg, ${primary} 0%, #1b5e20 100%)`,
          color: '#ffffff',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 96,
            height: 96,
            borderRadius: 24,
            background: 'rgba(255,255,255,0.16)',
            fontSize: 52,
            marginBottom: 40,
          }}
        >
          🛒
        </div>
        <div style={{ fontSize: 92, fontWeight: 800, lineHeight: 1.05 }}>
          {name}
        </div>
        <div
          style={{
            fontSize: 40,
            fontWeight: 500,
            marginTop: 24,
            maxWidth: 900,
            color: 'rgba(255,255,255,0.92)',
          }}
        >
          {description}
        </div>
        <div
          style={{
            display: 'flex',
            marginTop: 56,
            fontSize: 28,
            fontWeight: 600,
            letterSpacing: 1,
            color: 'rgba(255,255,255,0.85)',
          }}
        >
          Envíos a todo el país
        </div>
      </div>
    ),
    { ...size },
  )
}
