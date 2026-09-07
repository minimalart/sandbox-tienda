'use client'

import { Text } from '@medusajs/ui'
import { ChevronLeft, ChevronRight, Expand } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import ImageZoomModal from '@modules/common/components/image-zoom-modal'
import { handleImageError } from '@lib/util/placeholder-image'

import type { TintColorImage } from '../types'

/**
 * Fotos de ambiente del color elegido: carrusel chico abajo de la card del color
 * y, al hacer click, el visor a pantalla completa que ya usa el resto del sitio.
 *
 * El visor es `ImageZoomModal` y no uno propio: trae focus trap y Esc del
 * `Dialog` de Headless UI, zoom con doble click y pinch, y sobre todo el
 * `z-[10001]` correcto. Un overlay propio con un z-index más bajo se lo comen el
 * botón flotante de WhatsApp y el resto de las capas del layout, que van en
 * z-[10000].
 *
 * Las imágenes son del CDN del fabricante y se piden con `<img>` crudo, NO con
 * `next/image`, a propósito: son ~25.000 fotos distintas (3.132 colores x 8
 * ambientes) y cada una sería una "source image" del optimizador de Vercel, que
 * se factura y tiene tope mensual. El CDN ya redimensiona por query string
 * (`im=Resize,width=…`), así que la optimización la hace el origen gratis. Como
 * es hotlink de un tercero, va con `handleImageError` igual que los catálogos
 * importados.
 */

/** El CDN nombra los ambientes en inglés; la tienda está en castellano. */
const ROOM_LABELS: Record<string, string> = {
  Bathroom: 'Baño',
  Bedroom: 'Dormitorio',
  Childrensroom: 'Habitación infantil',
  DiningRoom: 'Comedor',
  Hallway: 'Pasillo',
  Homeoffice: 'Escritorio',
  Kitchen: 'Cocina',
  Livingroom: 'Living',
}

const roomLabel = (room: string | null): string | null =>
  room ? (ROOM_LABELS[room] ?? room) : null

/**
 * Ancho servido por el CDN. No se usa `URLSearchParams` porque encodea la coma
 * de `Resize,width=` como `%2C` y el origen deja de reconocer la transformación.
 * Si la URL guardada ya trae un `im=`, se respeta: alguien la eligió a mano.
 */
const withWidth = (url: string, width: number): string => {
  if (/[?&]im=/.test(url)) return url
  return `${url}${url.includes('?') ? '&' : '?'}im=Resize,width=${width}`
}

const THUMB_WIDTH = 600
const FULL_WIDTH = 1600

type Props = {
  colorName: string
  images: TintColorImage[]
}

const ColorPhotos = ({ colorName, images }: Props) => {
  const [index, setIndex] = useState(0)
  const [zoomed, setZoomed] = useState(false)
  /**
   * URLs que el browser ya tiene. Es un Set y no un booleano por foto: al volver
   * a una que ya se vio no tiene que aparecer el skeleton de nuevo.
   */
  const [loaded, setLoaded] = useState<Set<string>>(new Set())
  const markLoaded = useCallback(
    (url: string) => setLoaded((current) => (current.has(url) ? current : new Set(current).add(url))),
    [],
  )

  const total = images.length
  // El índice se clampea en vez de confiar en que el efecto de reset corra
  // primero: si el color nuevo tiene menos fotos, `images[index]` sería
  // `undefined` durante un render y el componente explota.
  const safeIndex = Math.min(index, Math.max(total - 1, 0))
  const go = useCallback(
    (delta: number) => setIndex((current) => (current + delta + total) % total),
    [total],
  )

  // El color puede cambiar sin desmontar el componente (paso 2 → otro color).
  // La dependencia es la firma de las URLs y no el array: el padre puede pasar
  // una referencia nueva en cada render y el carrusel quedaría clavado en la 1.
  const signature = images.map((image) => image.url).join('|')
  useEffect(() => {
    setIndex(0)
    setZoomed(false)
    // El Set se vacía con el color: las fotos del anterior ya no se van a ver y
    // dejarlas haría creer que las nuevas están listas.
    setLoaded(new Set())
  }, [signature])

  const current = images[safeIndex]
  const currentSrc = current ? withWidth(current.url, THUMB_WIDTH) : ''
  const isLoading = !!current && !loaded.has(currentSrc)

  /**
   * Precarga la anterior y la siguiente en cuanto la actual terminó. Sin esto
   * cada flecha dispara una descarga de cero contra el CDN y la foto tarda en
   * aparecer; con esto el segundo paso en adelante es instantáneo.
   *
   * Sólo las dos vecinas: precargar las 8 son ~2 MB por color, y el que mira una
   * foto y se va se los come igual.
   */
  useEffect(() => {
    // Depende del booleano y no del Set: si no, el efecto se repite con cada
    // foto que termina de cargar y vuelve a pedir las vecinas.
    if (isLoading) return
    for (const delta of [1, -1]) {
      const neighbour = images[(safeIndex + delta + total) % total]
      if (!neighbour) continue
      const img = new Image()
      img.src = withWidth(neighbour.url, THUMB_WIDTH)
    }
  }, [isLoading, safeIndex, total, images])

  /**
   * Al abrir el visor, precargar en grande la actual y sus vecinas: el modal
   * pide la versión de 1600 px, que es otra descarga distinta de la del carrusel.
   */
  useEffect(() => {
    if (!zoomed) return
    for (const delta of [0, 1, -1]) {
      const neighbour = images[(safeIndex + delta + total) % total]
      if (!neighbour) continue
      const img = new Image()
      img.src = withWidth(neighbour.url, FULL_WIDTH)
    }
  }, [zoomed, safeIndex, total, images])

  if (!total || !current) return null

  const label = roomLabel(current.room)
  const alt = label ? `${colorName} aplicado en ${label.toLowerCase()}` : colorName

  return (
    <section aria-label={`Fotos de ${colorName} en ambientes`} className="mt-3">
      <div className="relative overflow-hidden rounded-lg border border-ui-border-base">
        <button
          aria-label={`Ver ${alt} en tamaño completo`}
          className="group relative block w-full"
          onClick={() => setZoomed(true)}
          type="button"
        >
          {/* El skeleton va DEBAJO de la foto y no en lugar de ella: así el
              `<img>` empieza a cargar en el mismo frame en que se pide, y la
              caja no cambia de alto cuando aparece. */}
          {isLoading ? (
            <span
              aria-hidden
              className="absolute inset-0 animate-pulse bg-ui-bg-subtle"
            />
          ) : null}
          <img
            alt={alt}
            className={`aspect-[3/2] w-full bg-ui-bg-subtle object-cover transition-opacity duration-200 ${
              isLoading ? 'opacity-0' : 'opacity-100'
            }`}
            // `key` por URL: sin esto React reusa el mismo nodo al cambiar de
            // foto, el browser deja la anterior en pantalla mientras baja la
            // nueva y `onLoad` no vuelve a dispararse de forma confiable.
            key={currentSrc}
            // Nada de `loading="lazy"`: la foto está en el viewport apenas se
            // elige el color, y el lazy le agrega un salto extra al cambio.
            onError={(event) => {
              markLoaded(currentSrc)
              handleImageError(event)
            }}
            onLoad={() => markLoaded(currentSrc)}
            // Si la foto ya estaba en caché, el browser la resuelve antes de que
            // React ate el `onLoad` y el evento no llega nunca: la imagen se
            // quedaría invisible. `complete` en el ref cubre ese caso.
            ref={(node) => {
              if (node?.complete) markLoaded(currentSrc)
            }}
            src={currentSrc}
          />
          <span className="absolute right-2 top-2 rounded-md bg-black/55 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            <Expand className="size-3.5" />
          </span>
        </button>

        {total > 1 ? (
          <>
            <button
              aria-label="Foto anterior"
              className="absolute left-1 top-1/2 -translate-y-1/2 rounded-full bg-white/85 p-1 text-ui-fg-base shadow-sm transition-colors hover:bg-white"
              onClick={() => go(-1)}
              type="button"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              aria-label="Foto siguiente"
              className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-white/85 p-1 text-ui-fg-base shadow-sm transition-colors hover:bg-white"
              onClick={() => go(1)}
              type="button"
            >
              <ChevronRight className="size-4" />
            </button>
          </>
        ) : null}
      </div>

      <div className="mt-1.5 flex items-center justify-between gap-2">
        <Text className="truncate text-xs text-ui-fg-subtle">{label ?? 'Ambiente'}</Text>
        {total > 1 ? (
          <Text className="shrink-0 text-xs text-ui-fg-muted">
            {safeIndex + 1}/{total}
          </Text>
        ) : null}
      </div>

      <ImageZoomModal
        alt={alt}
        images={images.map((image) => ({
          id: image.room,
          url: withWidth(image.url, FULL_WIDTH),
        }))}
        initialIndex={safeIndex}
        onClose={() => setZoomed(false)}
        open={zoomed}
      />
    </section>
  )
}

export default ColorPhotos
