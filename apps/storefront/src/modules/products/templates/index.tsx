import type { HttpTypes } from '@medusajs/types'
import ProductViewTracker from '@lib/analytics/product-view-tracker'
import { isNewProduct } from '@lib/util/is-new-product'
import { getTenant } from '@lib/site-config/resolver'
import { getIndividualVariant } from '@lib/util/get-individual-variant'
import { isProductInStock } from '@lib/util/is-product-in-stock'
import { PLACEHOLDER_IMAGE } from '@lib/util/placeholder-image'
import { productSeoFromMetadata } from '@lib/util/seo/product-metadata'
import {
  getProductStockFromTypesense,
  getProductDataFromTypesense,
  searchTypesenseProducts,
} from '@lib/typesense'
import type { FragranceItem } from '@modules/products/components/fragrance-selector'
import PdpPromoBadge from '@modules/products/components/pdp-promo-badge'
import IdealFor from '@modules/products/components/ideal-for'
import OlfactoryNotes from '@modules/products/components/olfactory-notes'
import OtherPresentations from '@modules/products/components/other-presentations'
import ProductActions from '@modules/products/components/product-actions'
import type { KitProductDetails } from '@modules/products/components/product-actions'
import ProductBackButton from '@modules/products/components/product-back-button'
import ProductMedia from '@modules/products/components/product-media'
import TintConfigurator from '@modules/products/components/tint-configurator'
import PaymentBenefits from '@modules/products/components/payment-benefits'
import CommentsSection from '@modules/products/components/comments-section'
import RelatedProducts from '@modules/products/components/related-products'
import SameCategoryProducts from '@modules/products/components/same-category-products'
// Slot generado por el composer: con la extensión `recommendation-widgets` trae el
// bloque de recomendaciones; sin ella devuelve null. Nunca importar
// `@modules/recommendations/...` desde acá — el composer borra esa carpeta en los
// proyectos que no la seleccionan y `next build` fallaría.
import { RecommendationsPdpSlot } from '@lib/recommendations-slot'
import WishlistButton from '@modules/common/components/wishlist-button'
import ShareButton from '@modules/common/components/share-button'
import CompareButton from '@modules/common/components/compare-button'
import ProductInfo from '@modules/products/templates/product-info'
import SkeletonRelatedProducts from '@modules/skeletons/templates/skeleton-related-products'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import ProductActionsWrapper from './product-actions-wrapper'
import GiftCardConfiguratorSlot, { giftCardExperienceAvailable } from './gift-card-configurator-slot'

type ProductTemplateProps = {
  product: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
  countryCode: string
}

const ProductTemplate = async ({
  product,
  region,
  countryCode,
}: ProductTemplateProps) => {
  if (!product?.id) {
    return notFound()
  }

  // Gift cards are a configurator, not a physical-product PDP. Branch before
  // Typesense, stock merchandising, descriptions and related-product blocks.
  if (giftCardExperienceAvailable && product.is_giftcard === true) {
    return (
      <>
        <ProductViewTracker itemId={product.id} itemName={product.title ?? 'Gift Card'} />
        <GiftCardConfiguratorSlot countryCode={countryCode} product={product} region={region} />
      </>
    )
  }

  // Fetch Typesense data for discount information. Guard against a mismatched
  // document (e.g. search returning a sibling) by requiring id equality.
  const typesenseProductRaw = await getProductDataFromTypesense(product.id)
  const typesenseProduct =
    typesenseProductRaw?.id === product.id ? typesenseProductRaw : null

  const typesenseStock = await getProductStockFromTypesense(product.id)
  const inStock =
    typesenseStock !== null ? typesenseStock > 0 : isProductInStock(product)

  const productCategories =
    product.categories && product.categories.length > 0
      ? product.categories
      : (typesenseProduct?.categories as
          | HttpTypes.StoreProduct['categories']
          | undefined)

  // Merge Typesense discount data with Medusa product
  const productWithDiscount = typesenseProduct
    ? {
        ...product,
        categories: productCategories,
        discount: typesenseProduct.discount,
        subtotal: typesenseProduct.subtotal,
        price: typesenseProduct.price,
        promotions: typesenseProduct.promotions,
        usage_suggestion: typesenseProduct.usage_suggestion,
        olfactory_family: typesenseProduct.olfactory_family,
      }
    : product

  // Product metadata
  const productMeta = product.metadata as Record<string, unknown> | undefined
  const productErpSubcategoryId = productMeta?.erp_subcategory_id
  // `alt_text` del catalogador: se generaba para accesibilidad/SEO de imágenes y
  // la galería nunca lo consumía.
  const productAltText = productSeoFromMetadata(productMeta).altText

  // Fragrance name: read from Typesense product data (object { id, name })
  const productFragranceName = typesenseProduct?.fragrance?.name

  const tenant = await getTenant()
  const resellerKits = tenant.assets.resellerKits?.kits ?? []
  const currentKit = resellerKits.find((kit) => kit.productId === product.id)
  const isKitProduct = Boolean(currentKit)

  const kitDetails: KitProductDetails | null = currentKit
    ? await (async () => {
        const kitIds = resellerKits.map((kit) => kit.productId)
        const { products: kitProducts } = await searchTypesenseProducts({
          productIds: kitIds,
          limit: kitIds.length,
        })
        const kitProductMap = new Map(kitProducts.map((p) => [p.id, p]))

        return {
          options: resellerKits.map((kit) => {
            const kitProduct = kitProductMap.get(kit.productId)
            return {
              productId: kit.productId,
              title: kit.title,
              href: kitProduct?.handle
                ? `/products/${kitProduct.handle}`
                : kit.href || '/store?q=kit',
              image: kit.image,
            }
          }),
          contents: currentKit.contents ?? [],
        }
      })()
    : null

  // Fragrances: same erp_subcategory_id via Typesense
  const fragrances: FragranceItem[] = await (async () => {
    if (isKitProduct) return []
    if (productErpSubcategoryId === undefined) return []

    try {
      const { products: siblings } = await searchTypesenseProducts({
        erpSubcategoryId: String(productErpSubcategoryId),
        limit: 200,
      })

      return siblings
        .filter((p) => p.stock_available > 0)
        .sort((a, b) => {
          if (a.id === product.id) return -1
          if (b.id === product.id) return 1
          return 0
        })
        .map((p) => ({
          id: p.id,
          handle: p.handle,
          thumbnail: p.thumbnail || p.images?.[0]?.url || null,
          title: p.title,
        }))
    } catch (err) {
      console.error('[ProductTemplate] Error fetching fragrances:', err)
      return []
    }
  })()

  // Otras presentaciones: same fragrance via Typesense
  const otrasPresentaciones = await (async () => {
    if (!productFragranceName) return []

    try {
      const { products: siblings } = await searchTypesenseProducts({
        fragancia: productFragranceName,
        limit: 50,
      })

      const seen = new Set<string>()
      return siblings.filter((p) => {
        if (p.id === product.id) return false
        if (p.handle && product.handle && p.handle === product.handle) return false
        const key = p.handle || p.id
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
    } catch (err) {
      console.error(
        '[ProductTemplate] Error fetching otras presentaciones:',
        err,
      )
      return []
    }
  })()

  // GA4: view_item. Tomamos precio/moneda de la variante Individual.
  const viewItemVariant = getIndividualVariant(productWithDiscount.variants)
  const compareProduct = {
    id: productWithDiscount.id,
    title: productWithDiscount.title ?? 'Producto',
    handle: productWithDiscount.handle,
    thumbnail:
      productWithDiscount.thumbnail ||
      productWithDiscount.images?.[0]?.url ||
      currentKit?.image ||
      PLACEHOLDER_IMAGE,
    brandName: (productWithDiscount as { brand?: { name?: string } }).brand
      ?.name,
    categoryName:
      productWithDiscount.categories?.[productWithDiscount.categories.length - 1]
        ?.name,
    sku: viewItemVariant?.sku,
  }

  return (
    <>
      <ProductViewTracker
        itemId={product.id}
        itemName={product.title ?? 'unknown'}
        price={viewItemVariant?.calculated_price?.calculated_amount ?? undefined}
        currency={viewItemVariant?.calculated_price?.currency_code ?? undefined}
      />
      <main className='mx-auto max-w-7xl px-4 pt-6 sm:px-6 sm:pt-10 lg:px-8 lg:pt-12'>
        <div className='mx-auto max-w-2xl lg:max-w-none'>
          <ProductBackButton />
          {/* Product */}
          <div className='lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-12'>
            {/* Image gallery */}
            <div
              key={`media-${product.id}`}
              className='relative animate-fade-in-up'
              style={{ animationDelay: '0s' }}
            >
              {!inStock ? (
                <div className='absolute top-3 left-3 z-10'>
                  <span className='inline-flex w-[70px] h-[24px] items-center justify-center rounded-[8px] border-2 border-[#1E8BB4] bg-transparent font-bold text-[11px] uppercase tracking-wide text-[#1E8BB4]'>
                    Sin Stock
                  </span>
                </div>
              ) : (
                <PdpPromoBadge
                  product={productWithDiscount}
                  isNew={isNewProduct(productWithDiscount)}
                />
              )}
              <ProductMedia
                altText={productAltText}
                hasImageBadge={!inStock || isNewProduct(productWithDiscount)}
                images={
                  (productWithDiscount.images?.length ?? 0) > 0
                    ? productWithDiscount.images!
                    : currentKit?.image
                      ? [{ url: currentKit.image, id: 'kit-image', rank: 0 }]
                      : []
                }
                options={productWithDiscount.options}
              />
            </div>

            {/* Product info */}
            <div className='mt-6 px-0 lg:mt-0'>
              <div className='flex items-start justify-between gap-3'>
                <ProductInfo product={productWithDiscount} />
              </div>

              <div className='mt-4'>
                <Suspense
                  fallback={
                    <ProductActions
                      disabled={true}
                      product={productWithDiscount}
                      region={region}
                      description={productWithDiscount.description ?? undefined}
                      productPage={true}
                      inStock={inStock}
                      afterPriceActions={
                        viewItemVariant?.id ? (
                          <ProductActionLinks
                            compareProduct={compareProduct}
                            handle={productWithDiscount.handle}
                            productId={productWithDiscount.id}
                            title={productWithDiscount.title}
                            variantId={viewItemVariant.id}
                          />
                        ) : null
                      }
                    />
                  }
                >
                  <ProductActionsWrapper
                    id={productWithDiscount.id}
                    product={productWithDiscount}
                    region={region}
                    inStock={inStock}
                    fragrances={fragrances}
                    kitDetails={kitDetails}
                    afterPriceActions={
                      viewItemVariant?.id ? (
                        <>
                          <ProductActionLinks
                            compareProduct={compareProduct}
                            handle={productWithDiscount.handle}
                            productId={productWithDiscount.id}
                            title={productWithDiscount.title}
                            variantId={viewItemVariant.id}
                          />
                          {/* Entonado tintométrico. Va pegado al precio porque
                              elegir el color es OBLIGATORIO: el botón del footer
                              queda deshabilitado hasta que haya uno. Se autoapaga:
                              si la variante no es una base entonable (o la feature
                              está apagada) devuelve null y el PDP queda igual que
                              antes. */}
                          <TintConfigurator
                            currencyCode={region.currency_code}
                            productTitle={productWithDiscount.title}
                            variantId={viewItemVariant.id}
                          />
                        </>
                      ) : null
                    }
                  />
                </Suspense>
              </div>

              {/* Beneficios de pago (cuotas, descuentos, reintegros) — informativo */}
              <Suspense fallback={null}>
                <PaymentBenefits product={productWithDiscount} />
              </Suspense>
            </div>
          </div>

          {/* Mobile only — Familia olfativa + Ideal para, below product info col */}
          <div className='flex flex-col gap-6 lg:hidden animate-fade-in' style={{ animationDelay: '0.25s' }}>
            <IdealFor
              title='Familia olfativa'
              value={typesenseProduct?.olfactory_family}
              variant='tag'
            />
            <IdealFor
              title='Ideal para'
              value={typesenseProduct?.usage_suggestion}
            />
          </div>

          {/* Olfactory notes — full width on all breakpoints */}
          <div className='animate-fade-in' style={{ animationDelay: '0.32s' }}>
            <OlfactoryNotes
              metadata={
                productWithDiscount.metadata as
                  | Record<string, unknown>
                  | undefined
              }
            />
          </div>
        </div>
      </main>

      {/* Otras presentaciones — full width */}
      <section>
        <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
          <OtherPresentations
            products={otrasPresentaciones}
            countryCode={countryCode}
            isProductDetail
            fragranceName={productFragranceName}
          />
        </div>
      </section>

      {/* Same subcategory products */}
      <Suspense fallback={null}>
        <SameCategoryProducts
          countryCode={countryCode}
          product={productWithDiscount}
        />
      </Suspense>

      {/* Opiniones / reseñas (solo lectura) */}
      <Suspense fallback={null}>
        <CommentsSection commentableType='product' commentableId={product.id} />
      </Suspense>

      {/*
        Recomendaciones del motor: comprados juntos, complementarios y vistos
        recientemente. Los SIMILARES no van acá: los sirve `RelatedProducts` más
        abajo, que ahora consume el motor conservando su título y su lugar al final
        de la página.
      */}
      <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
        <RecommendationsPdpSlot
          product={productWithDiscount}
          region={region}
          countryCode={countryCode}
        />
      </div>

      {/* Related products */}
      <section aria-labelledby='related-heading'>
        <div className='mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8'>
          <Suspense fallback={<SkeletonRelatedProducts />}>
            <RelatedProducts
              countryCode={countryCode}
              product={productWithDiscount}
            />
          </Suspense>
        </div>
        <hr className='border-gray-200' />
      </section>

      {/* Alto reservado para la barra fija de "Agregar al carrito" */}
      <div aria-hidden='true' className='h-32 lg:h-28' />
    </>
  )
}

function ProductActionLinks({
  compareProduct,
  handle,
  productId,
  title,
  variantId,
}: {
  compareProduct: {
    id?: string
    title: string
    handle?: string | null
    thumbnail: string
    brandName?: string
    categoryName?: string
    sku?: string | null
  }
  handle?: string | null
  productId?: string
  title?: string | null
  variantId: string
}) {
  if (!productId) return null
  const comparableProduct = compareProduct.id
    ? { ...compareProduct, id: compareProduct.id }
    : null

  return (
    <div className='mt-2 flex flex-wrap items-center gap-2 border-y border-gray-100 py-2.5 sm:py-3'>
      <div className='pr-4'>
        <WishlistButton
          productId={productId}
          variantId={variantId}
          size='sm'
          label='Favoritos'
        />
      </div>
      {comparableProduct && (
        <div className='border-l border-gray-100 pl-4'>
          <CompareButton product={comparableProduct} size='sm' label='Comparar' />
        </div>
      )}
      <div className='border-l border-gray-100 pl-4'>
        <ShareButton
          handle={handle}
          title={title}
          size='sm'
          label='Compartir'
        />
      </div>
    </div>
  )
}

export default ProductTemplate
