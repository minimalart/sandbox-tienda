/**
 * Clasificación PURA de la fase de imágenes del catalog sync (testeable sin
 * container): decide a qué artículos hay que pedirles la foto al ERP.
 *
 * La regla de oro es NO PISAR NADA. El sync solo llena el vacío: un producto que
 * ya tiene `thumbnail` o alguna imagen queda intacto, aunque la foto la haya
 * subido alguien a mano y el ERP tenga otra. La razón es asimétrica: si nos
 * salteamos una foto que había que traer, se ve un producto sin imagen y se
 * arregla en la corrida siguiente; si pisamos la foto buena del cliente con el
 * JPEG de 200×200 del ERP, la original no vuelve.
 *
 * De ahí también sale la idempotencia gratis: la corrida que se cae a la mitad
 * retoma sola, porque lo ya importado dejó de calificar. Es lo que salvó la
 * primera importación real, que murió a las 327 imágenes por un `ECONNRESET`.
 */

import { shouldSkipImageFetch, type ImageFailures } from './image-failures';

/** Estado de imagen de un producto que matchea un código del ERP. */
export type ProductImageState = {
  /** Código del artículo en el ERP (= `variant.sku`). */
  code: string;
  product_id: string;
  has_thumbnail: boolean;
  has_images: boolean;
};

export type ProductImageFetch = {
  code: string;
  product_id: string;
};

export type ProductImagePlan = {
  /** Artículos a los que hay que pedirle la imagen al ERP. */
  fetches: ProductImageFetch[];
  /** Motivo → cuántos artículos se saltearon, para el resumen del log. */
  skipped: Record<string, number>;
};

export type PlanProductImagesOptions = {
  /**
   * Artículos que vienen fallando, para saltearlos. Se pasa en las pasadas
   * COMPLETAS (`backfill` y `full_sweep`) y NO en el delta: cuando el artículo
   * llega por el delta es porque algo cambió en el ERP —cargarle la foto le
   * mueve `fechahoramodife`—, y ahí hay que reintentar aunque esté en cooldown.
   * La decisión vive en `shouldSkipKnownImageFailures` (`full-sweep-scope.ts`);
   * el por qué del registro, en `image-failures.ts`.
   */
  failures?: ImageFailures;
  /** Inyectable para poder testear el cooldown sin esperar siete días. */
  now?: Date;
};

export function planProductImages(
  states: ProductImageState[],
  opts: PlanProductImagesOptions = {}
): ProductImagePlan {
  const fetches: ProductImageFetch[] = [];
  const skipped: Record<string, number> = {};
  const bump = (reason: string): void => {
    skipped[reason] = (skipped[reason] ?? 0) + 1;
  };
  // Varias variantes del mismo producto son varios códigos del ERP apuntando a
  // UNA sola ficha: pedir la imagen una vez por variante sería bajar la misma
  // foto N veces y después pisarla consigo misma.
  const seenProducts = new Set<string>();
  const now = opts.now ?? new Date();

  for (const state of states) {
    if (!state.product_id) {
      bump('no_product');
      continue;
    }
    if (state.has_thumbnail || state.has_images) {
      bump('already_has_image');
      continue;
    }
    // Va DESPUÉS de `already_has_image` y ANTES de `duplicate_product`: el que ya
    // tiene foto no interesa por qué se saltea, y un código en cooldown no puede
    // consumir el cupo del producto y dejar afuera a la variante hermana que sí
    // se puede pedir.
    if (opts.failures && shouldSkipImageFetch(opts.failures, state.code, now)) {
      bump('recently_failed');
      continue;
    }
    if (seenProducts.has(state.product_id)) {
      bump('duplicate_product');
      continue;
    }
    seenProducts.add(state.product_id);
    fetches.push({ code: state.code, product_id: state.product_id });
  }

  return { fetches, skipped };
}

/**
 * Nombre de archivo para el File module a partir del código del ERP.
 *
 * El `/` es la razón por la que esto existe: los códigos del catálogo real son
 * del tipo `010/50`, y una barra en el nombre se interpreta como carpeta — en S3
 * crea un prefijo fantasma y con el provider local directamente falla el write.
 * Se colapsa todo lo que no sea alfanumérico a `-`.
 *
 * Ese colapso hace colisionar códigos distintos (`010/50` y `010-50` dan el
 * mismo slug), y dos productos compartiendo archivo significa que el segundo
 * pisa la foto del primero en el bucket. Por eso el nombre lleva pegada una
 * huella del código CRUDO: es determinística, así que re-subir el mismo artículo
 * sigue cayendo en la misma clave.
 */
export function imageFilename(code: string, extension: string): string {
  const slug =
    code
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'articulo';
  return `erp/${slug}-${fingerprint(code)}.${extension}`;
}

/** FNV-1a de 32 bits en hex. Sin dependencias y estable entre corridas. */
function fingerprint(value: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}
