import { getActiveDemoSlug, getActiveTenant } from "@lib/site-config/active-tenant";
import { getProductsByIds, listProducts } from "@lib/data/products";
import { getAllVideos } from "@lib/data/videos";
import type { ShoppableVideoItem } from "@lib/site-config/types";
import type { HttpTypes } from "@medusajs/types";
import ShoppableVideosClient from "./client";
import type {
  ShoppableVideo,
  ShoppableVideosProps,
} from "./shoppableVideos.intefaces";

const ShoppableVideos = async ({
  region,
  countryCode,
  title: titleOverride,
  mobileTitle: mobileTitleOverride,
  description: descriptionOverride,
}: ShoppableVideosProps) => {
  const [tenant, medusaVideos, demoSlug] = await Promise.all([
    getActiveTenant(),
    getAllVideos(),
    getActiveDemoSlug(),
  ]);

  // Los overrides del bloque del home pisan lo del template; si el bloque no
  // trae el campo se cae al template y, en última instancia, al default.
  const shoppableVideosConfig = tenant.assets.shoppableVideos;
  const title =
    titleOverride || shoppableVideosConfig?.title || "Viví la experiencia";
  const mobileTitle =
    mobileTitleOverride ||
    shoppableVideosConfig?.mobileTitle ||
    "Nuestros videos";
  const description =
    descriptionOverride ??
    shoppableVideosConfig?.description ??
    "Inspirate con clips verticales y sumá los productos destacados a tu carrito con un solo clic.";

  // El backend ya devuelve solo videos con is_active: true. NO filtramos por
  // `status === "available"` ni exigimos productos vinculados: un video se
  // muestra igual aunque no tenga producto (estilo Selectio). El producto es
  // opcional y solo habilita la card "shoppable" cuando existe.
  // Además respetamos el flag por video `show_in_carousel` (default true).
  const availableVideos = medusaVideos.filter(
    (v) => v.is_active && v.show_in_carousel !== false,
  );

  // Fuente principal: videos reales del backend de Medusa (tienen prioridad).
  let videos: ShoppableVideo[] = [];

  if (availableVideos.length) {
    const productIds = Array.from(
      new Set(
        availableVideos.flatMap((v) => v.products?.map((p) => p.id) ?? []),
      ),
    );

    // Solo pedimos productos si algún video tiene productos vinculados.
    // Si el backend falla, los videos se muestran igual (producto opcional).
    let products: HttpTypes.StoreProduct[] = [];
    if (productIds.length) {
      try {
        products = await getProductsByIds({
          productIds,
          countryCode,
          extraFields: "*categories",
        });
      } catch (err) {
        console.error(
          "[ShoppableVideos] product fetch failed, rendering videos without products:",
          err,
        );
      }
    }

    // Mapeamos TODOS los videos activos. El producto es opcional: si el video
    // tiene uno vinculado lo resolvemos, si no, el video se muestra igual.
    videos = availableVideos.map((video) => {
      const linkedProductId = video.products?.[0]?.id;
      const product = linkedProductId
        ? products.find((p) => p.id === linkedProductId)
        : undefined;

      return {
        id: video.id,
        vimeoId: video.vimeo_id,
        poster: video.poster_url || video.thumbnail_url || product?.thumbnail || "",
        product,
        region,
      };
    });
  } else if (!demoSlug) {
    // Fallback (solo store principal): clips de Vimeo definidos en la config del
    // tenant, emparejados con productos reales del catálogo. En una demo NO
    // usamos este fallback: los videos se eligen por sales channel, así que sin
    // videos propios la sección se oculta (req: no mostrar componentes vacíos).
    videos = await buildVideosFromConfig({
      configVideos: shoppableVideosConfig?.videos ?? [],
      countryCode,
      region,
    });
  }

  if (!videos.length) {
    return null;
  }

  return (
    <ShoppableVideosClient
      videos={videos}
      title={title}
      mobileTitle={mobileTitle}
      description={description}
    />
  );
};

type BuildVideosArgs = {
  configVideos: ShoppableVideoItem[];
  countryCode: string;
  region: HttpTypes.StoreRegion;
};

/**
 * Arma los clips de la sección a partir de la config demo:
 * resuelve los productos vinculados por ID y rellena los que falten con
 * productos del catálogo, de modo que la sección renderice aunque no se
 * hayan curado IDs específicos.
 */
async function buildVideosFromConfig({
  configVideos,
  countryCode,
  region,
}: BuildVideosArgs): Promise<ShoppableVideo[]> {
  if (!configVideos.length) return [];

  const explicitIds = configVideos
    .map((v) => v.productId)
    .filter((id): id is string => Boolean(id));

  let explicitProducts: HttpTypes.StoreProduct[] = [];
  if (explicitIds.length) {
    try {
      explicitProducts = await getProductsByIds({
        productIds: explicitIds,
        countryCode,
        extraFields: "*categories",
      });
    } catch (err) {
      console.error("[ShoppableVideos] explicit product fetch failed:", err);
    }
  }

  const resolveExplicit = (id?: string) =>
    id ? explicitProducts.find((p) => p.id === id) : undefined;

  const missingCount = configVideos.filter(
    (v) => !resolveExplicit(v.productId),
  ).length;

  let fillerProducts: HttpTypes.StoreProduct[] = [];
  if (missingCount > 0) {
    try {
      const {
        response: { products },
      } = await listProducts({
        countryCode,
        queryParams: { limit: missingCount },
      });
      fillerProducts = products;
    } catch (err) {
      console.error("[ShoppableVideos] filler product fetch failed:", err);
    }
  }

  let fillerIndex = 0;
  return configVideos.map((item) => {
    const product = resolveExplicit(item.productId) ?? fillerProducts[fillerIndex++];

    return {
      id: item.id ?? `cfg-${item.vimeoId}`,
      vimeoId: item.vimeoId,
      poster: item.poster || product?.thumbnail || "",
      product,
      region,
    };
  });
}

export default ShoppableVideos;
