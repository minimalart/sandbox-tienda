"use client";

import { PLACEHOLDER_IMAGE } from "../util/placeholder-image";
import Image, { type ImageProps } from "next/image";
import { useEffect, useState } from "react";

type ProductImageProps = Omit<ImageProps, "src" | "onError"> & {
  /** URL del thumbnail. Vacía/null cae al placeholder. */
  src?: string | null;
};

/**
 * `next/image` para imágenes de producto, con fallback al placeholder.
 *
 * Los catálogos importados (Demo Stores) hotlinkean las imágenes de la tienda
 * origen: si esa URL muere (404, protección de hotlinking, http en página
 * https), `next/image` no tiene fallback propio y la card queda con el ícono de
 * imagen rota del browser. Acá capturamos el `onError` y mostramos el
 * placeholder.
 */
export default function ProductImage({ src, alt, ...rest }: ProductImageProps) {
  const resolved: string =
    typeof src === "string" && src.trim() ? src.trim() : PLACEHOLDER_IMAGE;
  const [failed, setFailed] = useState(false);

  // Las listas reciclan el componente al paginar/filtrar: si cambia la URL hay
  // que volver a intentar en vez de quedar pegado al placeholder.
  useEffect(() => {
    setFailed(false);
  }, [resolved]);

  return (
    <Image
      {...rest}
      alt={alt}
      src={failed ? PLACEHOLDER_IMAGE : resolved}
      onError={() => setFailed(true)}
    />
  );
}
