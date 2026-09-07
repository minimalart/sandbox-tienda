import { HttpTypes } from "@medusajs/types";

export type ShoppableVideo = {
  id: string;
  vimeoId: string;
  poster: string;
  /** Opcional: un video puede no tener producto vinculado (se muestra igual). */
  product?: HttpTypes.StoreProduct;
  region: HttpTypes.StoreRegion;
};

export type ShoppableVideosClientProps = {
  videos: ShoppableVideo[];
  title?: string;
  mobileTitle?: string;
  description?: string;
};

export type ShoppableVideosProps = {
  region: HttpTypes.StoreRegion;
  countryCode: string;
  /**
   * Overrides de textos que llegan del bloque del editor de home ("Personalizar
   * home"). Ausentes = se usan los del template (`assets.shoppableVideos`).
   * `description: ""` oculta la bajada (sin copy de relleno).
   */
  title?: string;
  mobileTitle?: string;
  description?: string;
};
