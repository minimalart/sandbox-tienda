'use client'

import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { useCartStore } from '@lib/stores/cart.store'
import { getIndividualVariant } from '@lib/util/get-individual-variant'
import { isProductInStock } from '@lib/util/is-product-in-stock'
import { useProductPromotion } from '@lib/hooks/use-product-promotion'
import { useScrollLock } from '@lib/hooks/use-scroll-lock'
import {
  PLACEHOLDER_IMAGE,
  handleImageError,
} from '@lib/util/placeholder-image'
import type {
  ShoppableVideo,
  ShoppableVideosClientProps,
} from './shoppableVideos.intefaces'
import { ShoppingCart, Volume2, VolumeX, X } from 'lucide-react'
import DisneyBadge from '@modules/common/components/disney-badge'
import VimeoPlayer, {
  type VimeoPlayerHandle,
} from '@modules/common/components/vimeo-player'
import { useAddToCartAnimation } from '@lib/context/add-to-cart-animation'
import LocalizedClientLink from '@modules/common/components/localized-client-link'
import { HttpTypes } from '@medusajs/types'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'

const getStoreCategoryHref = (product?: HttpTypes.StoreProduct) => {
  if (!product) return '/store'
  const category = product.categories?.[product.categories.length - 1]
  if (!category?.name) return '/store'
  return `/store?category=${encodeURIComponent(category.name)}`
}

const ShoppableVideosClient = ({
  videos,
  title = 'Viví la experiencia',
  mobileTitle = 'Nuestros videos',
  description = 'Explorá nuestros productos y agregalos a tu carrito con un solo clic',
}: ShoppableVideosClientProps) => {
  const [activeIndex, setActiveIndex] = useState<number>(0)
  const [addingId, setAddingId] = useState<string | null>(null)
  // El usuario elige una sola vez: el sonido queda persistente entre clips,
  // fullscreen y reels hasta que vuelva a cambiarlo.
  const [soundOn, setSoundOn] = useState(false)
  const desktopPlayerRef = useRef<VimeoPlayerHandle>(null)
  // Índice del clip abierto en pantalla completa (overlay). null = cerrado.
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)
  const swipeStartXRef = useRef<number | null>(null)
  const swipeStartYRef = useRef<number | null>(null)
  const swipeHandledRef = useRef(false)
  const addItem = useCartStore((s) => s.addItem)
  const cartItems = useCartStore((s) => s.cart?.items) ?? []
  const { triggerAnimation } = useAddToCartAnimation()

  const getCartCount = (variantId: string, productId?: string) =>
    (
      cartItems.find((i) => i.variant_id === variantId) ??
      (productId
        ? cartItems.find((i) => i.product_id === productId)
        : undefined)
    )?.quantity ?? 0

  const activeVideo = videos[activeIndex]
  const activeProduct = activeVideo?.product

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const item = videos[activeIndex]
    const product = item?.product
    if (!product || !isProductInStock(product)) return
    const variant = getIndividualVariant(product.variants)
    if (!variant) {
      return
    }

    const button = e.currentTarget as HTMLElement

    setAddingId(variant.id)
    // Animación en el click, no después del await: el carrito ya es optimista y
    // esperar la red retrasaba el despegue de la imagen.
    triggerAnimation(button, product.thumbnail || product.images?.[0]?.url)
    try {
      const countryCode = item.region.countries?.[0]?.iso_2 || 'ar'
      await addItem(
        variant.id,
        1,
        countryCode,
        product.id,
        undefined,
        {
          title: product.title,
          handle: product.handle,
          thumbnail: product.thumbnail || product.images?.[0]?.url,
          unitPrice:
            variant.calculated_price?.calculated_amount ??
            (product as { subtotal?: number; price?: number }).subtotal ??
            (product as { subtotal?: number; price?: number }).price,
          currencyCode: variant.calculated_price?.currency_code,
        },
      )
    } finally {
      setAddingId(null)
    }
  }

  const scroll = useCallback(
    (direction: 'left' | 'right') => {
      if (direction === 'left') {
        setActiveIndex((prev) => (prev - 1 + videos.length) % videos.length)
      } else {
        setActiveIndex((prev) => (prev + 1) % videos.length)
      }
    },
    [videos.length],
  )

  const toggleSound = (e: React.MouseEvent) => {
    e.stopPropagation()
    // setMuted SÍNCRONO dentro del onClick para heredar el gesto del usuario
    // (desmutar sin gesto hace que el navegador pause el clip). El setState va
    // después: dispararlo primero no cambia el orden, pero deja claro que el
    // efecto sobre el player no depende del re-render.
    const next = !soundOn
    desktopPlayerRef.current?.setMuted(!next)
    setSoundOn(next)
  }

  const getVideoPosition = (videoIndex: number) => {
    const diff = (videoIndex - activeIndex + videos.length) % videos.length
    const normalizedDiff =
      diff > videos.length / 2 ? diff - videos.length : diff
    return normalizedDiff
  }

  const handleAddToCartFor = async (
    e: React.MouseEvent,
    item: ShoppableVideo,
  ) => {
    e.preventDefault()
    e.stopPropagation()
    const product = item.product
    if (!product || !isProductInStock(product)) return
    const variant = getIndividualVariant(product.variants)
    if (!variant) return

    const button = e.currentTarget as HTMLElement
    setAddingId(variant.id)
    triggerAnimation(button, product.thumbnail || product.images?.[0]?.url)
    try {
      const countryCode = item.region.countries?.[0]?.iso_2 || 'ar'
      await addItem(
        variant.id,
        1,
        countryCode,
        product.id,
        undefined,
        {
          title: product.title,
          handle: product.handle,
          thumbnail: product.thumbnail || product.images?.[0]?.url,
          unitPrice:
            variant.calculated_price?.calculated_amount ??
            (product as { subtotal?: number; price?: number }).subtotal ??
            (product as { subtotal?: number; price?: number }).price,
          currencyCode: variant.calculated_price?.currency_code,
        },
      )
    } finally {
      setAddingId(null)
    }
  }

  const handleSwipeStart = (clientX: number, clientY: number) => {
    swipeStartXRef.current = clientX
    swipeStartYRef.current = clientY
    swipeHandledRef.current = false
  }

  const handleSwipeEnd = (clientX: number, clientY: number) => {
    if (swipeStartXRef.current === null || swipeStartYRef.current === null) {
      return
    }

    const deltaX = clientX - swipeStartXRef.current
    const deltaY = clientY - swipeStartYRef.current
    swipeStartXRef.current = null
    swipeStartYRef.current = null

    if (Math.abs(deltaX) < 60 || Math.abs(deltaX) < Math.abs(deltaY) * 1.2) {
      return
    }

    swipeHandledRef.current = true
    scroll(deltaX > 0 ? 'left' : 'right')
  }

  // Con el overlay (lightbox/reels) abierto, pausar el player del carrusel para
  // no superponer dos audios; reanudarlo al cerrar. El iframe ya quedó
  // desbloqueado, así que reanudar mantiene el sonido sin pedir gesto.
  useEffect(() => {
    const player = desktopPlayerRef.current
    if (!player) return
    if (expandedIndex !== null) {
      player.pause()
    } else {
      player.play()
    }
  }, [expandedIndex])

  return (
    <>
    <section className='py-20'>
      <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
        <div className='mb-8 text-center'>
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

        {videos.length > 1 && (
          <div className='mb-6 hidden justify-start sm:flex md:justify-end'>
            <div className='flex items-center gap-2'>
              <button
                aria-label='Anterior'
                className='flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-[--primary-color] shadow-sm transition hover:border-[--primary-color] hover:bg-[--primary-color] hover:text-white focus:outline-none'
                onClick={() => scroll('left')}
                type='button'
              >
                <ChevronLeftIcon className='h-5 w-5' />
              </button>
              <button
                aria-label='Siguiente'
                className='flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-[--primary-color] shadow-sm transition hover:border-[--primary-color] hover:bg-[--primary-color] hover:text-white focus:outline-none'
                onClick={() => scroll('right')}
                type='button'
              >
                <ChevronRightIcon className='h-5 w-5' />
              </button>
            </div>
          </div>
        )}

        {/* Carrusel Selectio (responsive): foco central + laterales escalados.
            Mismo carrusel en desktop y mobile; el reels vive en el fullscreen. */}
        <div
          className='relative mt-10 cursor-grab touch-pan-y overflow-hidden select-none active:cursor-grabbing'
          onPointerDown={(e) => {
            if (e.pointerType === 'mouse' && e.button !== 0) return
            handleSwipeStart(e.clientX, e.clientY)
          }}
          onPointerMove={(e) => {
            const startX = swipeStartXRef.current
            const startY = swipeStartYRef.current
            if (startX === null || startY === null) return
            const target = e.currentTarget as HTMLElement
            if (target.hasPointerCapture(e.pointerId)) return
            const dx = e.clientX - startX
            const dy = e.clientY - startY
            if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
              target.setPointerCapture(e.pointerId)
            }
          }}
          onPointerUp={(e) => {
            handleSwipeEnd(e.clientX, e.clientY)
            const target = e.currentTarget as HTMLElement
            if (target.hasPointerCapture(e.pointerId)) {
              target.releasePointerCapture(e.pointerId)
            }
          }}
          onPointerCancel={() => {
            swipeStartXRef.current = null
            swipeStartYRef.current = null
          }}
          onDragStart={(e) => e.preventDefault()}
        >
          <div
            className='relative flex items-center justify-center gap-3 pb-4 px-4 md:gap-4'
            style={{ minHeight: '498px' }}
          >
            {videos.map((item, videoIndex) => {
              const position = getVideoPosition(videoIndex)
              const isVisible = Math.abs(position) <= 2

              if (!isVisible) return null

              // Con pocos videos (1-2), el coverflow desalinea el player y deja
              // tarjetas laterales grises (sin poster): mostramos solo la activa
              // centrada, y el player flotante cae exactamente encima.
              if (videos.length < 3 && position !== 0) return null

              const isActive = position === 0
              const distance = Math.abs(position)
              const cardWidth = isActive ? 280 : distance === 1 ? 240 : 200
              const cardHeight = isActive ? 498 : distance === 1 ? 427 : 356

              return (
                <div
                  className='relative shrink-0 cursor-pointer overflow-hidden rounded-[28px] bg-gray-900 shadow-xl'
                  key={item.id}
                  role='button'
                  tabIndex={0}
                  onClick={() => {
                    if (swipeHandledRef.current) {
                      swipeHandledRef.current = false
                      return
                    }
                    if (!isActive) setActiveIndex(videoIndex)
                  }}
                  style={{
                    order: position + 2,
                    width: cardWidth,
                    height: cardHeight,
                    transform: `scale(${isActive ? 1 : distance === 1 ? 0.9 : 0.8})`,
                    opacity: isActive ? 1 : distance === 1 ? 0.7 : 0.4,
                    zIndex: isActive ? 10 : 5 - distance,
                    transition: `all 0.4s cubic-bezier(0.4, 0, 0.2, 1) ${distance * 150}ms`,
                  }}
                >
                  {/* Poster de cada tarjeta. En la activa queda de fondo bajo el
                      player flotante (fallback mientras Vimeo carga o cambia). */}
                  {item.poster && (
                    <img
                      alt={item.product?.title ?? 'Video'}
                      className='absolute inset-0 h-full w-full object-cover scale-[1.01]'
                      draggable={false}
                      src={item.poster}
                    />
                  )}
                </div>
              )
            })}

            {/* UN solo player persistente sobre la tarjeta central. No se
                desmonta al navegar: cambia de clip con loadVideo() para no
                perder el audio que el usuario desbloqueó con un gesto. El
                wrapper replica el centrado del flex (items-center + pb-4) para
                caer exactamente sobre la tarjeta activa. */}
            {activeVideo && (
              <div className='pointer-events-none absolute inset-0 z-20 flex items-center justify-center pb-4'>
                <div
                  className='pointer-events-auto relative shrink-0 overflow-hidden rounded-[28px] bg-black shadow-xl'
                  style={{ width: 280, height: 498 }}
                >
                  <VimeoPlayer
                    ref={desktopPlayerRef}
                    videoId={activeVideo.vimeoId}
                    poster={activeVideo.poster}
                    autoplay
                    loop
                    muted={!soundOn}
                    controls={false}
                    autopause={false}
                    playSignal={`${activeIndex}-${soundOn}`}
                    title={activeProduct?.title ?? 'Video'}
                    className='relative h-full w-full overflow-hidden bg-black'
                    iframeStyle={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      width: '250%',
                      height: '175%',
                      transform: 'translate(-50%, -50%)',
                      border: 'none',
                    }}
                  />
                  {/* Capa transparente: click en el video abre fullscreen */}
                  <button
                    type='button'
                    aria-label='Ver en pantalla completa'
                    onClick={(e) => {
                      e.stopPropagation()
                      if (swipeHandledRef.current) {
                        swipeHandledRef.current = false
                        return
                      }
                      setExpandedIndex(activeIndex)
                    }}
                    className='absolute inset-0 z-10 cursor-pointer'
                  />
                  <button
                    aria-label={soundOn ? 'Silenciar' : 'Activar sonido'}
                    type='button'
                    onClick={toggleSound}
                    className='absolute left-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-colors hover:bg-black/70'
                  >
                    {soundOn ? (
                      <Volume2 className='h-5 w-5' />
                    ) : (
                      <VolumeX className='h-5 w-5' />
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {activeProduct && (
            <div className='mt-5 flex justify-center'>
              <ShoppableProductCard
                item={videos[activeIndex]}
                productHref={getStoreCategoryHref(activeProduct)}
                addingId={addingId}
                getCartCount={getCartCount}
                onAddToCart={handleAddToCart}
                className='w-[280px] border border-gray-200 py-3 shadow-sm transition-all hover:shadow-md'
              />
            </div>
          )}
        </div>

      </div>
    </section>

    {expandedIndex !== null && (
      <ExpandedVideoOverlay
        videos={videos}
        initialIndex={expandedIndex}
        addingId={addingId}
        getCartCount={getCartCount}
        handleAddToCartFor={handleAddToCartFor}
        getProductHref={(product) =>
          product ? getStoreCategoryHref(product) : ''
        }
        soundOn={soundOn}
        setSoundOn={setSoundOn}
        onClose={() => setExpandedIndex(null)}
      />
    )}
    </>
  )
}

type ExpandedVideoOverlayProps = {
  videos: ShoppableVideo[]
  initialIndex: number
  onClose: () => void
  addingId: string | null
  getCartCount: (variantId: string, productId?: string) => number
  handleAddToCartFor: (
    e: React.MouseEvent,
    item: ShoppableVideo,
  ) => Promise<void>
  getProductHref: (product?: HttpTypes.StoreProduct) => string
  soundOn: boolean
  setSoundOn: React.Dispatch<React.SetStateAction<boolean>>
}

/**
 * Fullscreen para ver los clips en grande. En desktop es un lightbox de un
 * solo video con controles nativos; en MOBILE es un feed reels (swipe vertical
 * entre todos los clips) que arranca en el que se tocó. Cierra con el botón,
 * Escape o (desktop) click en el backdrop.
 *
 * El overlay solo se monta tras un click (cliente), así que medir el ancho acá
 * no rompe SSR.
 */
const ExpandedVideoOverlay = ({
  videos,
  initialIndex,
  onClose,
  addingId,
  getCartCount,
  handleAddToCartFor,
  getProductHref,
  soundOn,
  setSoundOn,
}: ExpandedVideoOverlayProps) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const playerRef = useRef<VimeoPlayerHandle>(null)

  const goToVideo = useCallback(
    (direction: 'previous' | 'next') => {
      setCurrentIndex((prev) =>
        direction === 'previous'
          ? (prev - 1 + videos.length) % videos.length
          : (prev + 1) % videos.length,
      )
    },
    [videos.length],
  )

  // El overlay se monta solo cuando está abierto: bloqueamos el scroll de fondo
  // durante todo su ciclo de vida.
  useScrollLock(true)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') goToVideo('previous')
      if (e.key === 'ArrowRight') goToVideo('next')
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
    }
  }, [goToVideo, onClose])

  const toggleSound = (e: React.MouseEvent) => {
    e.stopPropagation()
    // setMuted síncrono dentro del gesto (ver nota en el carrusel).
    const next = !soundOn
    playerRef.current?.setMuted(!next)
    setSoundOn(next)
  }

  const isMobile = useMemo(
    () => typeof window !== 'undefined' && window.innerWidth < 640,
    [],
  )

  const closeButton = (
    <button
      aria-label='Cerrar'
      type='button'
      onClick={(e) => {
        e.stopPropagation()
        onClose()
      }}
      className='absolute right-4 top-4 z-[12010] flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition hover:bg-black/70'
    >
      <X className='h-6 w-6' />
    </button>
  )

  const portalTarget = typeof document === 'undefined' ? null : document.body
  if (!portalTarget) return null

  // Mobile: feed reels a pantalla completa, arrancando en el clip tocado.
  if (isMobile) {
    return createPortal(
      <div
        className='fixed inset-0 z-[12000] overflow-hidden overscroll-contain bg-black'
        style={{ height: '100dvh' }}
        role='dialog'
        aria-modal='true'
      >
        {closeButton}
        <MobileReels
          videos={videos}
          initialIndex={initialIndex}
          addingId={addingId}
          getCartCount={getCartCount}
          handleAddToCartFor={handleAddToCartFor}
          getProductHref={getProductHref}
          soundOn={soundOn}
          setSoundOn={setSoundOn}
        />
      </div>,
      portalTarget,
    )
  }

  // Desktop: lightbox con navegación, card shoppable y controles propios.
  const item = videos[currentIndex]
  if (!item) return null
  return createPortal(
    <div
      className='fixed inset-0 z-[12000] flex items-center justify-center overflow-hidden overscroll-contain bg-black/90 p-4'
      style={{ height: '100dvh' }}
      onClick={onClose}
      role='dialog'
      aria-modal='true'
    >
      {closeButton}
      {videos.length > 1 && (
        <>
          <button
            aria-label='Video anterior'
            type='button'
            onClick={(e) => {
              e.stopPropagation()
              goToVideo('previous')
            }}
            className='absolute left-6 top-1/2 z-[12010] hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition hover:bg-white/25 sm:flex'
          >
            <ChevronLeftIcon className='h-6 w-6' />
          </button>
          <button
            aria-label='Video siguiente'
            type='button'
            onClick={(e) => {
              e.stopPropagation()
              goToVideo('next')
            }}
            className='absolute right-6 top-1/2 z-[12010] hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition hover:bg-white/25 sm:flex'
          >
            <ChevronRightIcon className='h-6 w-6' />
          </button>
        </>
      )}
      <div className='flex h-full max-h-[90vh] w-full max-w-[760px] items-center justify-center gap-5'>
        <div
          className='relative aspect-[9/16] h-full max-h-[90vh] max-w-full overflow-hidden rounded-2xl bg-black'
          onClick={(e) => e.stopPropagation()}
        >
          <VimeoPlayer
            ref={playerRef}
            videoId={item.vimeoId}
            poster={item.poster}
            autoplay
            loop
            controls={false}
            muted={!soundOn}
            autopause={false}
            playSignal={`${currentIndex}-${soundOn}`}
            title={item.product?.title ?? 'Video'}
            className='absolute inset-0 h-full w-full'
            iframeStyle={{
              position: 'absolute',
              inset: '0',
              width: '100%',
              height: '100%',
              border: 'none',
            }}
          />
          <button
            aria-label={soundOn ? 'Silenciar' : 'Activar sonido'}
            type='button'
            onClick={toggleSound}
            className='absolute left-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-colors hover:bg-black/70'
          >
            {soundOn ? (
              <Volume2 className='h-5 w-5' />
            ) : (
              <VolumeX className='h-5 w-5' />
            )}
          </button>
          {item.product && (
            <div className='absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/70 to-transparent p-3 pt-12'>
              <ShoppableProductCard
                item={item}
                productHref={getProductHref(item.product)}
                addingId={addingId}
                getCartCount={getCartCount}
                onAddToCart={(e) => handleAddToCartFor(e, item)}
                className='w-full bg-white/95 py-2.5 shadow-lg backdrop-blur-sm'
              />
            </div>
          )}
        </div>
      </div>
    </div>,
    portalTarget,
  )
}

type MobileReelsProps = {
  videos: ShoppableVideo[]
  /** Clip en el que arranca el feed (el que se tocó para abrir fullscreen). */
  initialIndex?: number
  addingId: string | null
  getCartCount: (variantId: string, productId?: string) => number
  handleAddToCartFor: (
    e: React.MouseEvent,
    item: ShoppableVideo,
  ) => Promise<void>
  getProductHref: (product?: HttpTypes.StoreProduct) => string
  soundOn: boolean
  setSoundOn: React.Dispatch<React.SetStateAction<boolean>>
}

/**
 * Feed mobile tipo "reels": clips verticales a casi pantalla completa con
 * snap vertical. Solo el clip visible reproduce; cada uno tiene su control de
 * sonido y la tarjeta de producto superpuesta abajo.
 */
const MobileReels = ({
  videos,
  initialIndex = 0,
  addingId,
  getCartCount,
  handleAddToCartFor,
  getProductHref,
  soundOn,
  setSoundOn,
}: MobileReelsProps) => {
  const [visibleIndex, setVisibleIndex] = useState(initialIndex)
  const playerRef = useRef<VimeoPlayerHandle>(null)
  const touchStartYRef = useRef<number | null>(null)

  const goToVideo = useCallback(
    (direction: 'previous' | 'next') => {
      setVisibleIndex((prev) =>
        direction === 'previous'
          ? (prev - 1 + videos.length) % videos.length
          : (prev + 1) % videos.length,
      )
    },
    [videos.length],
  )

  const toggleSound = (e: React.MouseEvent) => {
    e.stopPropagation()
    const next = !soundOn
    playerRef.current?.setMuted(!next)
    setSoundOn(next)
  }

  const currentItem = videos[visibleIndex]
  if (!currentItem) return null

  const product = currentItem.product

  return (
    <div className='relative h-full w-full overflow-hidden bg-black'>
      {currentItem.poster && (
        <img
          alt={currentItem.product?.title ?? 'Video'}
          className='absolute inset-0 h-full w-full object-cover'
          src={currentItem.poster}
        />
      )}
      <VimeoPlayer
        ref={playerRef}
        videoId={currentItem.vimeoId}
        poster={currentItem.poster}
        autoplay
        loop
        muted={!soundOn}
        controls={false}
        autopause={false}
        playSignal={`${visibleIndex}-${soundOn}`}
        title={currentItem.product?.title ?? 'Video'}
        className='pointer-events-none absolute inset-0 h-full w-full'
        iframeStyle={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: '250%',
          height: '100%',
          transform: 'translate(-50%, -50%)',
          border: 'none',
        }}
      />

      {/* Capa transparente sobre el iframe: Vimeo (cross-origin) se traga los
          touch, así que el swipe vertical para cambiar de clip se captura acá.
          El botón de sonido y la card de producto (z-20) quedan por encima. */}
      <div
        className='absolute inset-0 z-10'
        style={{ touchAction: 'none' }}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => {
          touchStartYRef.current = e.touches[0]?.clientY ?? null
        }}
        onTouchEnd={(e) => {
          const startY = touchStartYRef.current
          touchStartYRef.current = null
          const endY = e.changedTouches[0]?.clientY
          if (startY == null || endY == null) return
          const deltaY = endY - startY
          if (Math.abs(deltaY) < 50) return
          goToVideo(deltaY > 0 ? 'previous' : 'next')
        }}
      />

      <button
        aria-label={soundOn ? 'Silenciar' : 'Activar sonido'}
        type='button'
        onClick={toggleSound}
        onPointerDown={(e) => e.stopPropagation()}
        className='absolute left-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm'
      >
        {soundOn ? (
          <Volume2 className='h-5 w-5' />
        ) : (
          <VolumeX className='h-5 w-5' />
        )}
      </button>

      {product && (
        <div className='absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/70 to-transparent px-3 pb-7 pt-12'>
          <ShoppableProductCard
            item={currentItem}
            productHref={getProductHref(product)}
            addingId={addingId}
            getCartCount={getCartCount}
            onAddToCart={(e) => handleAddToCartFor(e, currentItem)}
            className='w-full bg-white/95 py-3.5 shadow-lg backdrop-blur-sm'
            titleClamp={2}
          />
        </div>
      )}
    </div>
  )
}

type ShoppableProductCardProps = {
  item: ShoppableVideo
  productHref: string
  addingId: string | null
  getCartCount: (variantId: string, productId?: string) => number
  onAddToCart: (e: React.MouseEvent<HTMLButtonElement>) => void | Promise<void>
  className?: string
  /** Renglones del título: 1 por defecto, 2 para el reel mobile. */
  titleClamp?: 1 | 2
}

const ShoppableProductCard = ({
  item,
  productHref,
  addingId,
  getCartCount,
  onAddToCart,
  className = '',
  titleClamp = 1,
}: ShoppableProductCardProps) => {
  const product = item.product
  const variant = getIndividualVariant(product?.variants)
  const {
    hasDiscount,
    priceWithSymbol,
    formattedOriginalPrice,
    promotionType,
    promotionLabel,
    promotionName,
  } = useProductPromotion({
    product,
    selectedVariant: variant,
    region: item.region,
  })

  if (!product) return null

  const isAdding = addingId === variant?.id
  const cartCount = variant ? getCartCount(variant.id, product.id) : 0
  const inStock = isProductInStock(product)

  return (
    <div
      className={`flex items-center gap-3 rounded-2xl bg-white px-3 ${className}`}
    >
      <LocalizedClientLink
        href={productHref}
        className='flex min-w-0 flex-1 items-center gap-3'
      >
        <div className='h-12 w-12 flex-shrink-0 overflow-hidden rounded-full bg-gray-100'>
          <img
            alt={product.title ?? 'Producto'}
            className='h-full w-full object-cover'
            onError={handleImageError}
            src={
              product.thumbnail ||
              product.images?.[0]?.url ||
              PLACEHOLDER_IMAGE
            }
          />
        </div>
        <div className='min-w-0 flex-1 text-left'>
          <p
            className={`${titleClamp === 2 ? 'line-clamp-2' : 'line-clamp-1'} text-sm font-semibold text-gray-900`}
          >
            {product.title}
          </p>
          <div className='flex flex-col gap-0.5'>
            <div className='flex min-w-0 items-baseline gap-2 whitespace-nowrap'>
              <span className='shrink-0 text-sm font-semibold text-gray-900'>
                {priceWithSymbol}
              </span>
              {!hasDiscount && <DisneyBadge productId={product.id} />}
            </div>
            {hasDiscount && promotionType === 'buyget' && promotionLabel && (
              <div className='flex items-center gap-2'>
                <span className='text-xs font-semibold text-orange-600'>
                  {promotionLabel}
                </span>
              </div>
            )}
            {hasDiscount &&
              promotionType !== 'buyget' &&
              formattedOriginalPrice && (
                <div className='flex min-w-0 items-center gap-2'>
                  <span className='min-w-0 truncate text-[11px] text-gray-400 line-through'>
                    $ {formattedOriginalPrice}
                  </span>
                  {promotionName && (
                    <span className='text-xs font-semibold text-orange-600'>
                      {promotionName}
                    </span>
                  )}
                </div>
              )}
          </div>
        </div>
      </LocalizedClientLink>
      <button
        aria-label={inStock ? 'Agregar al carrito' : 'Sin stock'}
        className='inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-[--primary-color] bg-[--primary-color] text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50'
        // NO deshabilitar durante isAdding: el botón muestra el contador y
        // addItem acumula (get() fresco + red serializada), así que el clickeo
        // rápido suma de a 1. Deshabilitar descartaba los clicks en vuelo.
        disabled={!inStock}
        onClick={onAddToCart}
        type='button'
      >
        {cartCount > 0 ? (
          <span className='flex h-full w-full items-center justify-center rounded-full bg-[--primary-color] text-xs font-bold text-white'>
            {cartCount}
          </span>
        ) : isAdding ? (
          <span className='inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-r-transparent' />
        ) : (
          <ShoppingCart className='h-4 w-4 text-white' />
        )}
      </button>
    </div>
  )
}

export default ShoppableVideosClient
