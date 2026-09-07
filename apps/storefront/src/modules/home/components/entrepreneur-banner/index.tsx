import { getActiveTenant } from '@lib/site-config/active-tenant'
import type { ResellerKitsConfig } from '@lib/site-config/types'
import EntrepreneurCarouselClient from './entrepreneur-carousel-client'
import type { KitSlide } from './entrepreneur-carousel-client'

export default async function EntrepreneurBanner({
  config,
}: {
  /** Config inyectada por el editor del home; fallback a `assets.resellerKits`. */
  config?: ResellerKitsConfig
} = {}) {
  // getActiveTenant (no getDefaultTenant): en /demo/{slug} los combos son los
  // del demo, no los del store principal.
  const tenant = await getActiveTenant()
  const resellerKits = config ?? tenant.assets.resellerKits

  if (!resellerKits?.kits?.length) return null

  const kits: KitSlide[] = resellerKits.kits
    .filter((k) => k.video && k.poster)
    .map((k) => ({
      id: k.productId,
      title: k.title,
      subtitle: k.subtitle,
      image: k.image,
      video: k.video!,
      poster: k.poster!,
      bgColor: k.bgColor,
      href: k.href ?? '/store',
    }))

  if (!kits.length) return null

  return (
    <EntrepreneurCarouselClient
      kits={kits}
      title={resellerKits.titleHome}
      description={resellerKits.descriptionHome}
    />
  )
}
