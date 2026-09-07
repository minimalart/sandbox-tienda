/**
 * Contrato único de presentación para imágenes de PRODUCTO en todo el
 * storefront (grilla, PDP, relacionados, carrito, órdenes). Fuente de verdad:
 * ningún call-site debería volver a escribir estas clases sueltas.
 *
 * De dónde sale cada número (relevamiento del catálogo real, no una elección
 * estética arbitraria):
 *
 * - `1:1`: el 83,5% de las imágenes del catálogo YA son cuadradas (mediana
 *   del lado menor: 1512px). Forzar 1:1 en toda superficie es lo que menos
 *   recorta/deforma para la enorme mayoría de las fotos; el resto entra con
 *   aire de sobra en vez de recortarse.
 * - `object-contain`: para el 16,5% que no es cuadrado, la alternativa es
 *   `object-cover`, que recorta el envase. Recortar una lata de pintura (o
 *   cualquier producto) es peor que dejar aire de más — así que `contain`
 *   siempre, nunca `cover`, en ninguna superficie de producto.
 * - `p-[10%]` (relativo, no `scale-*` ni padding en px): el PLP usaba
 *   `scale-[0.75]` (≈12,5% de aire por lado, fijo sobre una caja que también
 *   cambia de tamaño según breakpoint) y el PDP usaba `p-6` (≈4,8% de aire,
 *   pero en px absolutos sobre una caja de ~500px — en una caja más chica el
 *   mismo `p-6` es un aire relativo mucho mayor). Promediando ambos y
 *   pasándolo a porcentaje da ~10%. Al ser relativo (`%` en vez de `px` o
 *   `scale`), la foto ocupa el mismo 80% de SU caja sin importar si la caja
 *   mide 64px (miniatura) o 500px (PDP) — que es exactamente lo que unifica
 *   la presentación entre superficies.
 *
 * Uso: el padding de aire se aplica a la propia `<Image fill>` (no al
 * contenedor) porque con `fill` el elemento es `position: absolute; inset: 0`
 * — con `box-sizing: border-box` (Tailwind preflight) el padding insetea el
 * content-box sin alterar el tamaño del contenedor. Es el mismo patrón que ya
 * usaba `product-media` con `p-6`/`p-4`, sólo que ahora relativo.
 */

/** Caja 1:1 para cualquier superficie que muestre una foto de producto. */
export const PRODUCT_IMAGE_ASPECT_CLASS = "aspect-square";

/**
 * Fit + aire de la imagen en sí (pensado para `<Image fill>`). Sin hover:
 * combinar con `PRODUCT_IMAGE_HOVER_CLASS` sólo donde ya existía interacción
 * de hover.
 */
export const PRODUCT_IMAGE_FIT_CLASS = "object-contain p-[10%]";

/**
 * Hover como transform sobre la imagen, NO como cambio del tamaño de reposo
 * (el patrón viejo era `scale-[0.75]` en reposo → `scale-[0.8]` en hover, es
 * decir la foto "crecía" de tamaño de base al pasar el mouse; el tamaño de
 * reposo ahora es fijo — `p-[10%]` — y sólo el hover escala). Requiere un
 * ancestro con la clase `group`. Respeta `prefers-reduced-motion` apagando la
 * transición (el salto de escala en sí es inevitable sin JS, pero al menos no
 * anima).
 */
export const PRODUCT_IMAGE_HOVER_CLASS =
  "transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100";

/**
 * Tres presets de `sizes`, uno por tamaño de render real (antes había ~9
 * valores distintos para lo mismo). El número no necesita ser exacto al
 * píxel: `sizes` es una pista para que el browser elija el srcset correcto,
 * no un layout constraint.
 */

/** Card de grilla (PLP, home, relacionados): ~2 columnas en mobile, ~3 en
 * tablet, tope de card ~280px en desktop — el tamaño más repetido entre las
 * cards existentes. */
export const PRODUCT_IMAGE_SIZES_GRID_CARD =
  "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 280px";

/** Imagen principal del PDP: ocupa (casi) todo el viewport en mobile y la
 * mitad en desktop (columna de galería al lado del panel de compra). */
export const PRODUCT_IMAGE_SIZES_PDP_MAIN = "(max-width: 1024px) 100vw, 50vw";

/** Miniaturas chicas: thumbnails del PDP, carrito, drawer, órdenes — cajas de
 * 64 a 120px según el contexto. */
export const PRODUCT_IMAGE_SIZES_THUMBNAIL = "96px";
