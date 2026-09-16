"use client";

import { useCompare } from "@lib/hooks/use-compare";
import { useTenant } from "@lib/site-config/context";
import { convertToLocale } from "@lib/util/money";
import {
  PLACEHOLDER_IMAGE,
  handleImageError,
} from "@lib/util/placeholder-image";
import { pricePerLiter } from "@lib/util/price-per-liter";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import { CheckCircle2, Trash2, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type CompareProductDetail = {
  id: string;
  title: string;
  handle?: string | null;
  description?: string | null;
  thumbnail?: string | null;
  images?: Array<{ url: string }> | null;
  brand?: { name?: string | null } | null;
  collection?: { title?: string | null } | null;
  categories?: Array<{ name?: string | null }> | null;
  variants?: Array<{
    title?: string | null;
    sku?: string | null;
    calculated_price?: {
      calculated_amount?: number | null;
      currency_code?: string | null;
    } | null;
    options?: Array<{
      value?: string | null;
      option?: { title?: string | null } | null;
    }> | null;
  }> | null;
  metadata?: Record<string, unknown> | null;
  stock_available?: number | null;
  olfactory_family?:
    | { name?: string | null }
    | Array<{ name?: string | null }>
    | null;
  usage_suggestion?:
    | { name?: string | null }
    | Array<{ name?: string | null }>
    | null;
  fragrance?: { name?: string | null } | null;
};

type CompareTemplateProps = {
  countryCode: string;
};

function formatMaybeList(
  value:
    | string
    | { name?: string | null }
    | Array<{ name?: string | null }>
    | null
    | undefined,
) {
  if (!value) return "N/A";
  if (typeof value === "string") return value || "N/A";
  if (Array.isArray(value)) {
    const names = value.map((item) => item.name).filter(Boolean);
    return names.length ? names.join(", ") : "N/A";
  }
  return value.name || "N/A";
}

function getProductImage(product: CompareProductDetail) {
  return (
    product.thumbnail ||
    product.images?.[0]?.url ||
    PLACEHOLDER_IMAGE
  );
}

function getProductPrice(product: CompareProductDetail) {
  const variant = product.variants?.[0];
  const amount = variant?.calculated_price?.calculated_amount;
  const currencyCode = variant?.calculated_price?.currency_code || "ARS";

  if (typeof amount !== "number") return "N/A";

  return convertToLocale({
    amount,
    currency_code: currencyCode,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    locale: "es-AR",
  });
}

function getCategory(product: CompareProductDetail) {
  const category = product.categories?.[product.categories.length - 1];
  return category?.name || "N/A";
}

/**
 * Etiqueta de presentación de la primera variante ("1 lt", "8,7 lt").
 *
 * Sale del `title` de la variante y no de `metadata.zeus_presentacion` a
 * propósito: esa clave es una CACHÉ de la regla de presentación del ERP y le
 * gana al título ya reescrito, así que como etiqueta para mostrar queda vieja.
 */
function getPresentation(product: CompareProductDetail) {
  return product.variants?.[0]?.title?.trim() || null;
}

/** Valor de una opción de la variante por título ("Color", "Formato"). */
function getOptionValue(product: CompareProductDetail, optionTitle: string) {
  const match = product.variants?.[0]?.options?.find(
    (option) =>
      option.option?.title?.toLowerCase() === optionTitle.toLowerCase(),
  );
  return match?.value?.trim() || "N/A";
}

/**
 * Precio por litro: el dato con el que realmente se decide entre dos pinturas
 * del mismo producto en envases distintos (BUG-09). Devuelve "N/A" cuando la
 * presentación no se puede leer con una única lectura — ver
 * `lib/util/price-per-liter.ts`, que prefiere no mostrar nada antes que mostrar
 * un número equivocado.
 */
function getPricePerLiter(product: CompareProductDetail) {
  const variant = product.variants?.[0];
  const perLiter = pricePerLiter(
    variant?.calculated_price?.calculated_amount,
    getPresentation(product),
  );
  if (perLiter === null) return "N/A";

  return `${convertToLocale({
    amount: perLiter,
    currency_code: variant?.calculated_price?.currency_code || "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    locale: "es-AR",
  })} / L`;
}

function getMetadataValue(
  product: CompareProductDetail,
  keys: string[],
) {
  const metadata = product.metadata ?? {};
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
    if (typeof value === "number") {
      return String(value);
    }
  }
  return "N/A";
}

const CompareTemplate = ({ countryCode }: CompareTemplateProps) => {
  const { items, removeItem, clear, isLoaded } = useCompare();
  const tenant = useTenant();
  const isSports = tenant.template === "sports";
  // El canal del tenant cliente ya está resuelto al canal del demo (lo inyecta
  // el layout (main)). Lo pasamos explícito al endpoint para que en demos los
  // productos se busquen en el catálogo correcto, sin depender de x-demo-slug.
  const salesChannelId = tenant.medusa.salesChannelId;
  const [products, setProducts] = useState<CompareProductDetail[]>([]);
  const [loading, setLoading] = useState(false);

  const productIds = useMemo(() => items.map((item) => item.id), [items]);

  useEffect(() => {
    if (!isLoaded || productIds.length === 0) {
      setProducts([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    Promise.all(
      productIds.map(async (id) => {
        const query = new URLSearchParams({ countryCode });
        query.set("id", id);
        if (salesChannelId) {
          query.set("salesChannelId", salesChannelId);
        }
        const response = await fetch(
          `/api/store/product?${query.toString()}`,
          { cache: "no-store" },
        );
        if (!response.ok) return null;
        const data = await response.json();
        return data.product as CompareProductDetail;
      }),
    )
      .then((result) => {
        if (!cancelled) {
          setProducts(
            result.filter(
              (product): product is CompareProductDetail => Boolean(product),
            ),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [countryCode, isLoaded, productIds, salesChannelId]);

  // Orden deliberado: primero lo que se COMPARA (precio por unidad, formato,
  // color, disponibilidad), después lo que sólo IDENTIFICA (categoría, SKU).
  //
  // QA reportó que el comparador mostraba Disponibilidad, SKU, Categoría y
  // Presentación y que, más allá del precio, nada de eso ayudaba a decidir
  // (DESDEELSUR-61 / BUG-09). El SKU pasó al final: sirve para pedir el producto
  // en el mostrador, no para elegirlo.
  //
  // Los atributos técnicos que también se pidieron — rendimiento, acabado,
  // secado, durabilidad — NO están en la base: lo único que manda Zeus es
  // color, familia, presentación, categoría y código de fábrica, y
  // `description` viene en null. Agregar esas filas daría columnas vacías; hay
  // que traer los campos del ERP primero.
  const rows = [
    {
      label: "Precio por litro",
      getValue: getPricePerLiter,
    },
    {
      label: "Formato",
      getValue: (product: CompareProductDetail) =>
        getPresentation(product) || "N/A",
    },
    {
      label: "Color",
      getValue: (product: CompareProductDetail) =>
        getOptionValue(product, "Color"),
    },
    {
      label: "Disponibilidad",
      getValue: (product: CompareProductDetail) =>
        (product.stock_available ?? 1) > 0 ? (
          <span className="inline-flex items-center gap-1.5 text-emerald-600">
            <CheckCircle2 className="h-4 w-4" />
            En stock
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-gray-500">
            <XCircle className="h-4 w-4" />
            Sin stock
          </span>
        ),
    },
    {
      label: "Marca",
      getValue: (product: CompareProductDetail) =>
        product.brand?.name || "N/A",
    },
    {
      label: "Fragancia",
      getValue: (product: CompareProductDetail) =>
        product.fragrance?.name || getMetadataValue(product, ["fragancia"]),
    },
    {
      label: "Familia olfativa",
      getValue: (product: CompareProductDetail) =>
        formatMaybeList(product.olfactory_family),
    },
    {
      label: "Ideal para",
      getValue: (product: CompareProductDetail) =>
        formatMaybeList(product.usage_suggestion),
    },
    {
      label: "Descripción",
      getValue: (product: CompareProductDetail) =>
        product.description || "N/A",
    },
    {
      label: "Categoría",
      getValue: getCategory,
    },
    {
      label: "Colección",
      getValue: (product: CompareProductDetail) =>
        product.collection?.title || "N/A",
    },
    {
      label: "SKU",
      getValue: (product: CompareProductDetail) =>
        product.variants?.[0]?.sku || "N/A",
    },
  ];

  const visibleRows = rows.filter((row) =>
    products.some((product) => {
      const value = row.getValue(product);
      return typeof value !== "string" || value !== "N/A";
    }),
  );

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <div className="flex flex-col gap-4 border-gray-200 border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-bold text-3xl text-gray-950 tracking-normal">
            Comparación de productos
          </h1>
          <p className="mt-2 max-w-2xl text-gray-600 text-sm leading-6">
            Evaluá atributos, disponibilidad y detalles de los productos que
            seleccionaste.
          </p>
        </div>
        {items.length > 0 && (
          <button
            className="inline-flex h-10 items-center justify-center rounded-full border border-gray-300 px-4 font-semibold text-gray-700 text-sm transition hover:border-gray-900 hover:text-gray-950"
            onClick={clear}
            type="button"
          >
            Limpiar comparación
          </button>
        )}
      </div>

      {!isLoaded || loading ? (
        <div className="mt-10 rounded-2xl border border-gray-200 bg-white p-8 text-center text-gray-500">
          Cargando comparación...
        </div>
      ) : products.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center">
          <h2 className="font-semibold text-gray-950 text-lg">
            Todavía no agregaste productos
          </h2>
          <p className="mx-auto mt-2 max-w-md text-gray-500 text-sm">
            Usá el icono de comparar en las tarjetas, quick view o ficha de
            producto para armar tu comparación.
          </p>
          <LocalizedClientLink
            className="mt-5 inline-flex h-11 items-center justify-center rounded-full bg-[--primary-color] px-5 font-semibold text-sm text-white transition hover:opacity-90"
            href="/store"
          >
            Ir a tienda
          </LocalizedClientLink>
        </div>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-2xl border border-gray-200 bg-white">
          <div
            className="grid min-w-[760px]"
            style={{
              gridTemplateColumns: `minmax(150px, 0.72fr) repeat(${products.length}, minmax(210px, 1fr))`,
            }}
          >
            <div className="border-gray-200 border-r p-5" />
            {products.map((product) => (
              <div
                className="relative border-gray-200 border-r p-5 text-center last:border-r-0"
                key={product.id}
              >
                <button
                  aria-label={`Quitar ${product.title}`}
                  className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-white text-gray-400 shadow-sm ring-1 ring-gray-200 transition hover:text-red-500"
                  onClick={() => removeItem(product.id)}
                  type="button"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <div className="mx-auto flex aspect-square w-full max-w-[190px] items-center justify-center rounded-2xl bg-gray-50 p-4">
                  <img
                    alt={product.title}
                    className="h-full w-full object-contain"
                    onError={handleImageError}
                    src={getProductImage(product)}
                  />
                </div>
                <h2 className="mx-auto mt-4 line-clamp-2 max-w-[220px] font-semibold text-gray-950 text-base">
                  {product.title}
                </h2>
                <p className="mt-2 font-bold text-[--primary-color] text-base">
                  {getProductPrice(product)}
                </p>
              </div>
            ))}

            {visibleRows.map((row, index) => (
              <div className="contents" key={row.label}>
                <div
                  className={`border-gray-200 border-t border-r px-5 py-4 font-semibold text-gray-900 text-sm ${
                    index % 2 === 0 ? "bg-gray-50" : "bg-white"
                  }`}
                >
                  {row.label}
                </div>
                {products.map((product) => (
                  <div
                    className={`border-gray-200 border-t border-r px-5 py-4 text-center text-gray-700 text-sm leading-6 last:border-r-0 ${
                      index % 2 === 0 ? "bg-gray-50" : "bg-white"
                    }`}
                    key={`${row.label}-${product.id}`}
                  >
                    {row.getValue(product)}
                  </div>
                ))}
              </div>
            ))}

            <div className="border-gray-200 border-t border-r p-5" />
            {products.map((product) => (
              <div
                className="border-gray-200 border-t border-r p-5 text-center last:border-r-0"
                key={`cta-${product.id}`}
              >
                <LocalizedClientLink
                  className={
                    isSports
                      ? "inline-flex h-11 items-center justify-center rounded-none border-2 border-[--sp-ink] bg-[--sp-ink] px-5 font-bold text-sm text-[--sp-on-dark] uppercase tracking-[0.06em] transition hover:bg-transparent hover:text-[--sp-ink]"
                      : "inline-flex h-11 items-center justify-center rounded-full bg-[--primary-color] px-5 font-semibold text-sm text-white transition hover:bg-[--primary-color-dark]"
                  }
                  href={product.handle ? `/products/${product.handle}` : "/store"}
                >
                  Ver producto
                </LocalizedClientLink>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
};

export default CompareTemplate;
