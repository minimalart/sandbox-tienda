import { getActiveTenant } from '@lib/site-config/active-tenant'
import { searchTypesenseProducts } from '@lib/typesense'
import LocalizedClientLink from '@modules/common/components/localized-client-link'
import Reveal from '@modules/common/components/reveal'
import ScrollCarousel from '@modules/common/components/scroll-carousel'
import TypesenseProductCard from '@modules/store/templates/typesense-product-card'
import { ArrowRight } from 'lucide-react'
import CompactProductCard from './compact-product-card'
import type {
  TenantAssets,
  FeaturedProductsConfig,
} from '@lib/site-config/types'

type FeaturedProductsGridProps = {
  countryCode: string
  productCategory?: keyof Pick<
    TenantAssets,
    | 'featuredProducts'
    | 'cleaningSolutions'
    | 'merchandising'
    | 'novedades'
    | 'destacadosDelMes'
    | 'renovaEnergia'
  >
  cardVariant?: 'default' | 'compact'
  /** Only show products that have an active promotion. */
  onlyPromotions?: boolean
  /** Hard cap on the number of product cards rendered. */
  maxItems?: number
  /**
   * When set, renders a trailing "ver todas" card (like the catalog card in
   * "Comprá por categoría") and switches to a native snap row so the CTA sits
   * once at the end and each swipe advances one card.
   */
  viewAllCard?: { label: string; href: string }
  /** Override del título (editor de home). Si se omite, usa el de assets. */
  title?: string
  /**
   * Override de la bajada (editor de home). Si se omite, usa la de assets; si
   * no hay ninguna, la sección va sin bajada (no hay texto por defecto).
   */
  description?: string
  /**
   * Config de contenido inyectada por el editor del home (bloque Puck). Si se
   * provee, se usa en lugar de `tenant.assets[productCategory]` (título,
   * descripción y filtro Typesense editados por el usuario).
   */
  config?: FeaturedProductsConfig
}

export default async function FeaturedProductsGrid({
  countryCode,
  productCategory = 'featuredProducts',
  cardVariant = 'default',
  onlyPromotions = false,
  maxItems,
  viewAllCard,
  title: titleOverride,
  description: descriptionOverride,
  config,
}: FeaturedProductsGridProps) {
  const tenant = await getActiveTenant()
  const assetConfig = config ?? tenant.assets[productCategory]

  if (!assetConfig) {
    return null
  }

  if (!('filter' in assetConfig)) {
    return null
  }

  const filter = (assetConfig as FeaturedProductsConfig).filter || {}
  const title = titleOverride || assetConfig.title || 'Productos destacados'
  const mobileTitle = (assetConfig as FeaturedProductsConfig).mobileTitle
  // Sin bajada NO se pinta nada: un texto por defecto acá se filtraba a todos
  // los demos (hablaba de fragancias/aromaterapia en una pinturería).
  const description = descriptionOverride || assetConfig.description || ''

  let result: Awaited<ReturnType<typeof searchTypesenseProducts>>
  try {
    result = await searchTypesenseProducts({
      limit: filter.limit || 12,
      sortBy: filter.sortBy,
      categoryId: filter.categoryId,
      collectionId: filter.collectionId,
      productIds: filter.productIds,
      q: filter.searchQuery,
      tag: filter.tag,
      onlyPromotions,
    })
  } catch (err) {
    // Un blip del backend/Typesense no debe tumbar la home entera:
    // esta sección simplemente no se renderiza.
    console.error(
      `[FeaturedProductsGrid] "${productCategory}" fetch failed, hiding section:`,
      err,
    )
    return null
  }

  const { products } = result

  // Post-filter: si hay un tag configurado, solo mantener productos que realmente lo tengan
  // Normaliza guiones/espacios para comparar (ej: "renova-energia" == "renova energia")
  const filteredProducts = filter.tag
    ? products.filter((p) => {
      const normalizedFilter = filter.tag!.replace(/-/g, ' ').toLowerCase()
      return p.tags?.some(
        (t) => t.value.replace(/-/g, ' ').toLowerCase() === normalizedFilter,
      )
    })
    : products

  filteredProducts.sort((a, b) => {
    const aInStock = a.stock_available > 0
    const bInStock = b.stock_available > 0
    if (aInStock === bInStock) return 0
    return aInStock ? -1 : 1
  })

  if (!filteredProducts?.length) {
    return null
  }

  const limitedProducts =
    typeof maxItems === 'number'
      ? filteredProducts.slice(0, maxItems)
      : filteredProducts

  const header = (
    <div>
      <p className='home-section-heading'>
        <span className='sm:hidden'>{mobileTitle || title}</span>
        <span className='hidden sm:inline'>{title}</span>
      </p>
      {description ? (
        <p className='mt-1 text-sm font-normal text-gray-500 sm:text-base'>
          {description}
        </p>
      ) : null}
    </div>
  )

  const renderCard = (product: (typeof limitedProducts)[number]) =>
    cardVariant === 'compact' ? (
      <CompactProductCard
        product={product}
        countryCode={countryCode}
        useSecondImage={productCategory === 'renovaEnergia'}
      />
    ) : (
      <TypesenseProductCard
        product={product}
        countryCode={countryCode}
        variant='home'
      />
    )

  // Sección "Ofertas": grid FIJO, sin carrusel ni loop ni flechas. La card
  // "ver todas" cierra la fila y la sección termina ahí. En desktop entran las
  // 5 (4 productos + CTA) en una fila; en mobile scrollea horizontal con snap.
  if (viewAllCard) {
    return (
      <Reveal as='section' className='relative py-8 sm:py-8 bg-[#f3f5f6]'>
        <div className='mx-auto max-w-7xl overflow-x-hidden px-4 sm:px-6 lg:px-8'>
          <div className='mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
            {header}
          </div>
          <div className='no-scrollbar grid grid-flow-col auto-cols-[72%] gap-4 overflow-x-auto pb-8 snap-x snap-mandatory sm:auto-cols-[42%] md:auto-cols-[30%] lg:grid-flow-row lg:auto-cols-auto lg:grid-cols-5 lg:overflow-visible'>
            {limitedProducts.map((product) => (
              <div key={product.id} className='snap-start'>
                {renderCard(product)}
              </div>
            ))}
            <LocalizedClientLink
              href={viewAllCard.href}
              className='group flex h-full min-h-[260px] snap-start flex-col items-start justify-between rounded-[24px] border border-gray-300 bg-white/60 p-6 text-left transition-all hover:border-[--primary-color] hover:shadow-md'
            >
              <p className='font-[700] text-2xl text-gray-900'>
                {viewAllCard.label}
              </p>
              <span className='inline-flex size-12 items-center justify-center rounded-full border border-gray-200 bg-white text-[--primary-color] transition group-hover:border-[--primary-color] group-hover:bg-[--primary-color] group-hover:text-white'>
                <ArrowRight className='size-5' />
              </span>
            </LocalizedClientLink>
          </div>
        </div>
      </Reveal>
    )
  }

  return (
    <Reveal as='section' className='relative py-8 sm:py-8 bg-[#f3f5f6]'>
      <div className='mx-auto max-w-7xl overflow-x-hidden px-4 sm:px-6 lg:px-8'>
        <ScrollCarousel
          disableScrollForFew
          title={header}
          headerClassName='mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'
          containerClassName='gap-4 pb-8'
          snap
        >
          {limitedProducts.map((product) => (
            <div
              key={product.id}
              className='w-[260px] flex-shrink-0 snap-start'
            >
              {renderCard(product)}
            </div>
          ))}
        </ScrollCarousel>
      </div>
    </Reveal>
  )
}
