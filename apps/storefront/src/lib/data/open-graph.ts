import "server-only"
import { cache } from "react"

/**
 * Open Graph configurado desde el admin (extensión SEO & GEO).
 *
 * Lo consume `generateMetadata()` del layout raíz y la tarjeta de
 * `app/opengraph-image.tsx`. Fetch propio y no el SDK por la misma razón que
 * `site-gate.ts`: así entra en el data cache de Next y no agrega una llamada al
 * backend por request.
 *
 * DEGRADA A NADA. Si la extensión no está instalada la ruta no existe (404), y si
 * el backend está caído tampoco hay card que mostrar: en los dos casos devuelve
 * `null` y el layout se queda con los valores que ya tenía. Es lo que permite que
 * este archivo viva en el storefront base, que no sabe qué extensiones hay.
 */

const BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"

export type OpenGraphConfig = {
  site_name: string
  title: string
  description: string
  image_url: string
  image_alt: string
  locale: string
  twitter_card: "summary_large_image" | "summary"
  twitter_site: string
}

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "")

export const getOpenGraphConfig = cache(
  async (): Promise<OpenGraphConfig | null> => {
    const pk = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
    try {
      const res = await fetch(`${BACKEND_URL}/store/seo-geo/open-graph`, {
        headers: {
          Accept: "application/json",
          ...(pk ? { "x-publishable-api-key": pk } : {}),
        },
        // La key identifica la tienda, así que el tag va scopeado por key: sin eso,
        // revalidar la card de una tienda invalidaría la de todas.
        next: { revalidate: 300, tags: [`open-graph:${pk ?? "default"}`] },
      })
      if (!res.ok) return null
      const data = (await res.json()) as { open_graph?: Record<string, unknown> }
      const og = data?.open_graph
      if (!og) return null
      const card = str(og.twitter_card)
      return {
        site_name: str(og.site_name),
        title: str(og.title),
        description: str(og.description),
        image_url: str(og.image_url),
        image_alt: str(og.image_alt),
        locale: str(og.locale),
        twitter_card: card === "summary" ? "summary" : "summary_large_image",
        twitter_site: str(og.twitter_site),
      }
    } catch {
      return null
    }
  }
)
