import { Container, clx } from "@medusajs/ui";
import PlaceholderImage from "@modules/common/icons/placeholder-image";
import ProductImage from "@modules/common/components/product-image";
import {
  PRODUCT_IMAGE_ASPECT_CLASS,
  PRODUCT_IMAGE_SIZES_THUMBNAIL,
} from "@lib/util/product-image-presets";
import type React from "react";

type ThumbnailProps = {
  thumbnail?: string | null;
  // TODO: Fix image typings
  images?: any[] | null;
  size?: "small" | "medium" | "large" | "full" | "square";
  className?: string;
  "data-testid"?: string;
};

const Thumbnail: React.FC<ThumbnailProps> = ({
  thumbnail,
  images,
  size = "small",
  className,
  "data-testid": dataTestid,
}) => {
  const initialImage = thumbnail || images?.[0]?.url;

  return (
    <Container
      className={clx(
        "relative w-full overflow-hidden rounded-large bg-ui-bg-subtle p-4 shadow-elevation-card-rest transition-shadow duration-150 ease-in-out group-hover:shadow-elevation-card-hover",
        {
          [PRODUCT_IMAGE_ASPECT_CLASS]: true,
          "w-[120px]": size === "small",
          "w-[290px]": size === "medium",
          "w-[440px]": size === "large",
          "w-full": size === "full",
        },
        // El className del consumidor va AL FINAL a propósito. `clx` de
        // @medusajs/ui es `twMerge(clsx(...))`, y tailwind-merge resuelve un
        // conflicto entre clases de la MISMA familia quedándose con la última
        // — no depende del orden en que Tailwind emita el CSS. Antes esto iba
        // primero, así que el ancho de acá (`w-[120px]`, etc.) le ganaba al
        // del consumidor y los call-sites tenían que pelearlo con `!w-20`
        // — ver order/item y order/confirmed-item-row, ya limpios.
        className,
      )}
      data-testid={dataTestid}
    >
      <ImageOrPlaceholder image={initialImage} size={size} />
    </Container>
  );
};

const ImageOrPlaceholder = ({
  image,
  size,
}: Pick<ThumbnailProps, "size"> & { image?: string }) =>
  image ? (
    // `ProductImage` en vez de `next/image` crudo: si la URL muere (catálogos
    // importados que hotlinkean) cae al placeholder en vez del ícono de imagen
    // rota del browser.
    <ProductImage
      alt="Thumbnail"
      // object-contain (igual que las cards del PLP y del home): con
      // object-cover las imágenes verticales se recortaban y se veían
      // incompletas en el carrito, el minicarrito y el checkout.
      //
      // Nota: acá NO se suma el `p-[10%]` del preset compartido — el
      // `Container` que envuelve esta imagen ya tiene `p-4` fijo como parte
      // de su chrome de card (fondo, rounded, shadow). Sumar el 10%
      // relativo encima de eso sobre-espaciaría una caja de 64-120px.
      className="absolute inset-0 object-contain object-center"
      draggable={false}
      fill
      quality={50}
      sizes={PRODUCT_IMAGE_SIZES_THUMBNAIL}
      src={image}
    />
  ) : (
    <div className="absolute inset-0 flex h-full w-full items-center justify-center">
      <PlaceholderImage size={size === "small" ? 16 : 24} />
    </div>
  );

export default Thumbnail;
