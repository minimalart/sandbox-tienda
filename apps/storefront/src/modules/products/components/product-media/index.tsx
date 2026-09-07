"use client";

import type { HttpTypes } from "@medusajs/types";
import ImageZoomModal from "@modules/common/components/image-zoom-modal";
import { ArrowsPointingOutIcon } from "@heroicons/react/24/outline";
import ProductImage from "@modules/common/components/product-image";
import { ImageVariantLabels } from "@modules/common/components/variant-labels";
import type { VariantLabelOption } from "@lib/util/variant-labels";
import {
  PRODUCT_IMAGE_FIT_CLASS,
  PRODUCT_IMAGE_SIZES_PDP_MAIN,
  PRODUCT_IMAGE_SIZES_THUMBNAIL,
} from "@lib/util/product-image-presets";
import { useCallback, useRef, useState } from "react";

type ProductMediaProps = {
  images: HttpTypes.StoreProductImage[];
  /** Options del producto, para las etiquetas de formato/color sobre la imagen. */
  options?: VariantLabelOption[] | null;
  /**
   * El template ya pinta un badge ("Nuevo" / "Sin Stock") arriba a la izquierda
   * del contenedor de la galería. Cuando ese badge cae encima de la imagen, los
   * colores se corren para abajo para no solaparse.
   */
  hasImageBadge?: boolean;
  /**
   * `metadata.alt_text` del catalogador: texto alternativo descriptivo del
   * producto. Sin esto la galería servía `alt="Imagen 1"`, que para un lector de
   * pantalla y para Google Images no dice absolutamente nada.
   */
  altText?: string | null;
};

const ProductMedia = ({
  images,
  options,
  hasImageBadge = false,
  altText,
}: ProductMediaProps) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [zoomIndex, setZoomIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const hasMultipleImages = images.length > 1;

  /**
   * El `alt_text` es UNO por producto (el catalogador lo guarda en
   * `product.metadata`, no por imagen), así que describe la principal. Repetirlo
   * en las 5 fotos sería texto alternativo duplicado, que es una penalización en
   * sí misma: de la segunda en adelante seguimos numerando.
   */
  const imageAlt = (index: number) =>
    index === 0 && altText ? altText : `Imagen ${index + 1}`;

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollLeft, clientWidth } = scrollRef.current;
    const index = Math.round(scrollLeft / clientWidth);
    setSelectedIndex(index);
  }, []);

  const openZoom = (index: number) => {
    setZoomIndex(index);
    setZoomOpen(true);
  };

  if (!images?.length) {
    return <div className="aspect-square w-full rounded-lg bg-gray-100" />;
  }

  const zoomImages = images
    .filter((img): img is HttpTypes.StoreProductImage & { url: string } =>
      Boolean(img.url),
    )
    .map((img) => ({ url: img.url, id: img.id }));

  return (
    <div className="flex flex-col gap-4">
      {/* Desktop layout: thumbnails on left + main image */}
      <div className="hidden lg:flex lg:gap-4">
        {/* Thumbnails - only show when multiple images */}
        {hasMultipleImages && (
          <div className="flex flex-col gap-3">
            {images.map((image, idx) => (
              <button
                key={image.id ?? idx}
                onClick={() => setSelectedIndex(idx)}
                className={`relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg border-2 transition-all ${
                  selectedIndex === idx
                    ? "border-[--primary-color] ring-1 ring-[--primary-color]"
                    : "border-gray-200 hover:border-gray-300"
                }`}
                type="button"
              >
                {/* Numeradas a propósito: acá el alt es el nombre accesible del
                    BOTÓN de navegación, no la descripción de la foto. */}
                {image.url && (
                  <ProductImage
                    alt={`Imagen ${idx + 1}`}
                    // object-contain (igual que la imagen principal): es
                    // incoherente que la miniatura recorte el envase y la
                    // imagen grande no.
                    className={PRODUCT_IMAGE_FIT_CLASS}
                    fill
                    sizes={PRODUCT_IMAGE_SIZES_THUMBNAIL}
                    src={image.url}
                  />
                )}
              </button>
            ))}
          </div>
        )}

        {/* Main image */}
        <button
          aria-label="Ampliar imagen"
          className="relative flex-1 overflow-hidden rounded-lg border border-gray-200 bg-white"
          onClick={() => openZoom(selectedIndex)}
          type="button"
        >
          <div className="relative aspect-square">
            {images[selectedIndex]?.url && (
              <ProductImage
                alt={imageAlt(selectedIndex)}
                className={PRODUCT_IMAGE_FIT_CLASS}
                fill
                priority
                sizes={PRODUCT_IMAGE_SIZES_PDP_MAIN}
                src={images[selectedIndex].url}
              />
            )}
          </div>
          <span className="absolute top-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-md">
            <ArrowsPointingOutIcon className="h-5 w-5 text-gray-600" />
          </span>
          {/* Con miniaturas el badge del template queda sobre la columna de
              miniaturas, no sobre la imagen: no hace falta correr los colores. */}
          <ImageVariantLabels
            colorTopClass={hasImageBadge && !hasMultipleImages ? "top-12" : "top-3"}
            options={options}
          />
        </button>
      </div>

      {/* Mobile layout: swipeable carousel with dots */}
      <div className="lg:hidden">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex snap-x snap-mandatory overflow-x-auto"
          style={{
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {images.map((image, idx) => (
            <div
              key={image.id ?? idx}
              className="w-full flex-shrink-0 snap-center snap-always"
            >
              <button
                aria-label="Ampliar imagen"
                className="relative block aspect-square w-full bg-white"
                onClick={() => openZoom(idx)}
                type="button"
              >
                {image.url && (
                  <ProductImage
                    alt={imageAlt(idx)}
                    className={PRODUCT_IMAGE_FIT_CLASS}
                    fill
                    priority={idx === 0}
                    sizes={PRODUCT_IMAGE_SIZES_PDP_MAIN}
                    src={image.url}
                  />
                )}
                <span className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-md">
                  <ArrowsPointingOutIcon className="h-4 w-4 text-gray-600" />
                </span>
                {/* En mobile no hay columna de miniaturas: el badge del template
                    cae siempre sobre la imagen. */}
                <ImageVariantLabels
                  colorTopClass={hasImageBadge ? "top-12" : "top-3"}
                  options={options}
                />
              </button>
            </div>
          ))}
        </div>

        {/* Dot indicators */}
        {hasMultipleImages && (
          <div className="mt-3 flex justify-center gap-2">
            {images.map((_, idx) => (
              <button
                key={idx}
                onClick={() => {
                  scrollRef.current?.scrollTo({
                    left: idx * (scrollRef.current?.clientWidth ?? 0),
                    behavior: "smooth",
                  });
                  setSelectedIndex(idx);
                }}
                className={`rounded-full transition-all ${
                  selectedIndex === idx
                    ? "h-2.5 w-2.5 bg-[--primary-color]"
                    : "h-2 w-2 bg-gray-300"
                }`}
                type="button"
                aria-label={`Ir a imagen ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* El visor ya aceptaba `alt` pero nadie lo pasaba: la foto ampliada, que
          es la que el usuario mira de verdad, quedaba con el `alt="Imagen"`
          genérico del default. */}
      <ImageZoomModal
        alt={altText ?? undefined}
        open={zoomOpen}
        onClose={() => setZoomOpen(false)}
        images={zoomImages}
        initialIndex={zoomIndex}
      />
    </div>
  );
};

export default ProductMedia;
