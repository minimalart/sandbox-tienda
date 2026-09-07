import { cn } from "@lib/util/cn";
import repeat from "@lib/util/repeat";

/**
 * Tarjetas fantasma con la grilla de la tienda.
 *
 * Existe además de `@modules/skeletons/templates/skeleton-product-grid` porque
 * aquél usa otra grilla (2 → 4 columnas, gaps grandes) y sirve para ocupar la
 * pantalla entera antes del primer render. Éste se apila DEBAJO de productos ya
 * renderizados mientras el infinite scroll trae la próxima tanda, así que tiene
 * que caer en las mismas columnas y con la misma forma de card que
 * `typesense-product-grid` / `typesense-product-card`; si no, el bloque de
 * carga se ve como una grilla ajena pegada al final de la lista.
 */
type ProductGridSkeletonProps = {
  /** Tarjetas fantasma a mostrar. Por defecto una fila de desktop. */
  count?: number;
  /** El template `sports` usa celdas cuadradas con hairlines, sin gaps. */
  variant?: "default" | "sports";
  className?: string;
};

const ProductGridSkeleton = ({
  count = 4,
  variant = "default",
  className,
}: ProductGridSkeletonProps) => {
  const isSports = variant === "sports";

  return (
    <div
      className={cn(
        "mx-auto animate-pulse",
        isSports ? "max-w-none px-0" : "max-w-7xl px-0",
        className,
      )}
      data-testid="product-grid-skeleton"
    >
      <ul
        aria-hidden="true"
        className={cn(
          "grid grid-cols-2 items-stretch sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4",
          isSports
            ? "border-[--sp-hairline] border-l border-t bg-white"
            : "justify-items-center gap-x-2 gap-y-2 pr-2 xl:gap-x-[8px]",
        )}
      >
        {repeat(count).map((index) => (
          <li
            className={cn(
              "flex w-full",
              isSports
                ? "border-[--sp-hairline] border-b border-r p-3 sm:p-4 lg:p-5"
                : "max-w-[216px]",
            )}
            key={index}
          >
            <div
              className={cn(
                "flex h-full w-full flex-col overflow-hidden bg-white",
                isSports
                  ? "border-0 bg-transparent"
                  : "rounded-[24px] border border-gray-200",
              )}
            >
              {/* Imagen: mismo `aspect-square` que la card real, para que la
                  altura de la fila fantasma coincida con la de los productos. */}
              <div
                className={cn(
                  "aspect-square w-full",
                  isSports ? "bg-gray-100" : "rounded-t-[24px] bg-[#F6F6F6]",
                )}
              />
              <div className="flex flex-1 flex-col gap-2 p-3">
                <div className="h-3 w-1/3 rounded bg-gray-100" />
                <div className="h-4 w-full rounded bg-gray-100" />
                <div className="h-4 w-2/3 rounded bg-gray-100" />
                <div className="mt-auto h-6 w-1/2 rounded bg-gray-200" />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ProductGridSkeleton;
