import type { MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import { truncateError } from '../sanitize';
import {
  groupRenamesByValue,
  type PresentationPlan,
  type PresentationProductState,
} from './presentation-option';
import { normalizePresentationLabel, presentationFromNormalizedTitle } from './product-title';

/**
 * Lado de LECTURA y ESCRITURA de la etiqueta de presentación. La decisión la toma
 * `planPresentationOptions` (pura); acá solo se lee el estado y se aplica.
 *
 * El renombre va por `updateProductOptionValues`, que cambia el `value` de la
 * fila `product_option_value` CONSERVANDO su id. Eso importa: la variante apunta
 * al valor por id, así que un rename in situ no toca el link. Hacerlo con
 * `updateProductOptionValuesOnProduct` (add + remove) desengancharía la variante.
 *
 * Y va por el módulo de producto, no por un workflow, por la misma razón que
 * `applyProductMetadata`: los workflows emiten `product.updated` por producto y
 * eso dispara un reindex de Typesense por producto. Los productos tocados se
 * devuelven para que el motor los meta en el evento batcheado del final.
 */

const READ_CHUNK = 200;
/** Variantes por llamada al update de títulos. */
const TITLE_CHUNK = 500;

type ProductOptionWriter = {
  updateProductOptionValues(
    selector: { id: string[] },
    data: { value: string }
  ): Promise<unknown>;
  updateProductVariants(selector: { id: string[] }, data: { title: string }): Promise<unknown>;
};

/**
 * Estado de presentación de los productos que matchean los códigos del ERP.
 *
 * Se lee por variante (como `readExistingProducts`) porque el match con el ERP es
 * por SKU, pero se necesita el producto entero: la cantidad de variantes y los
 * valores de su option deciden si el renombre aplica.
 */
export async function readPresentationState(
  container: MedusaContainer,
  codes: string[]
): Promise<PresentationProductState[]> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const byProduct = new Map<string, PresentationProductState>();
  if (!codes.length) return [];

  type Row = {
    id: string;
    sku: string | null;
    title: string | null;
    metadata: Record<string, unknown> | null;
    product_id: string | null;
    product?: {
      id: string;
      title?: string | null;
      variants?: Array<{ id: string }> | null;
      options?: Array<{
        id: string;
        title?: string | null;
        values?: Array<{ id: string; value: string | null }> | null;
      }> | null;
    } | null;
  };

  for (let i = 0; i < codes.length; i += READ_CHUNK) {
    const chunk = codes.slice(i, i + READ_CHUNK);
    const { data: variants } = (await query.graph({
      entity: 'product_variant',
      fields: [
        'id',
        'sku',
        'title',
        'metadata',
        'product_id',
        'product.id',
        // Respaldo de la presentación cuando la variante no tiene
        // `zeus_presentacion`; ver el comentario del fallback más abajo.
        'product.title',
        'product.variants.id',
        'product.options.id',
        // El título distingue la opción de presentación de la de color, que no
        // cuenta como una presentación más.
        'product.options.title',
        'product.options.values.id',
        'product.options.values.value',
      ],
      filters: { sku: chunk },
    })) as { data: Row[] };

    for (const variant of variants) {
      const productId = variant.product?.id ?? variant.product_id;
      if (!productId || byProduct.has(productId)) continue;
      /**
       * `zeus_presentacion` lo deja el catalog sync al normalizar el título, así
       * que las variantes que nunca pasaron por ahí no lo tienen — y son
       * exactamente las ~117 bases entonables, que crea
       * `tinting/bases/sync-products`. Sin presentación, `planPresentationOptions`
       * las saltea con `sin_presentacion` y su chip se queda para siempre en la
       * etiqueta con la que nacieron: hoy 19 bases muestran `18 lt` debajo de un
       * título que dice `x20 lt`, y `supersededPresentationLabels` —escrita para
       * ese caso— nunca llega a ejecutarse.
       *
       * El respaldo es el título del producto, que a esta altura ya está
       * normalizado y declara el envase. No pisa a `zeus_presentacion`: es sólo
       * para cuando no hay.
       *
       * Y cuando SÍ hay, se vuelve a pasar por la regla, porque
       * `zeus_presentacion` es una CACHÉ del resultado de R25 y no un dato crudo
       * del ERP: para una base la escribe `presentationOf` —que ya pasó por
       * `normalizePresentationLabel(..., { tintBase: true })`— y para el resto la
       * escribe el catalog sync. Cuando la tabla de envases cambia, el valor
       * guardado queda RANCIO y le gana al título recién reescrito: una base de
       * 8,7 creada con la regla vieja tiene `9 lt` en la metadata, así que el
       * chip se declararía correcto mientras la card dice `x10 lt`
       * (DESDEELSUR-27). Volver a normalizarlo es idempotente si está fresco y
       * se autocorrige si no. El catalog sync refresca esa metadata solo al subir
       * `TITLE_RULES_VERSION`; las bases que crea `tinting/bases/sync-products`
       * nunca pasan por ahí, y son justo éstas.
       *
       * Sólo para BASES, y por el mismo marcador que usa el resto del módulo: un
       * envase de 9 litros de verdad no es una base y convertirlo a 10 sería
       * mentir sobre el producto.
       */
      const cached = variant.metadata?.zeus_presentacion;
      const presentation =
        (variant.metadata?.tinting_base === true && typeof cached === 'string'
          ? (normalizePresentationLabel(cached, { tintBase: true }) ?? cached)
          : cached) ?? presentationFromNormalizedTitle(variant.product?.title);
      byProduct.set(productId, {
        product_id: productId,
        // Todas las variantes del producto, no solo la que matcheó: con más de una
        // el renombre no aplica.
        variants: (variant.product?.variants ?? [{ id: variant.id }]).map((row) => ({
          variant_id: row.id,
          // El título y la presentación solo se conocen de la variante que matcheó
          // el SKU; para las demás alcanza con contarlas.
          title: row.id === variant.id ? variant.title : null,
          presentation:
            row.id === variant.id && typeof presentation === 'string' ? presentation : null,
        })),
        option_values: (variant.product?.options ?? []).flatMap((option) =>
          (option.values ?? []).map((value) => ({
            option_value_id: value.id,
            value: value.value,
            option_title: option.title ?? null,
          }))
        ),
      });
    }
  }
  return [...byProduct.values()];
}

export type PresentationApplyResult = {
  renamed: number;
  titles_updated: number;
  touchedProductIds: Set<string>;
  errors: string[];
};

/** Aplica el plan. Nunca lanza: los fallos vuelven en `errors`. */
export async function applyPresentationOptions(
  container: MedusaContainer,
  plan: PresentationPlan
): Promise<PresentationApplyResult> {
  const result: PresentationApplyResult = {
    renamed: 0,
    titles_updated: 0,
    touchedProductIds: new Set(),
    errors: [],
  };
  if (!plan.renames.length && !plan.variant_titles.length) return result;

  /**
   * `updateProductOptionValues` y `updateProductVariants` con selector SÍ están en
   * `IProductModuleService`; el cast es solo para acotar la superficie que se usa
   * (las sobrecargas por id/selector no se dejan inferir cómodamente).
   */
  const products = container.resolve(Modules.PRODUCT) as unknown as ProductOptionWriter;

  // Agrupado por valor destino: N productos que van a "1 L" son UNA llamada.
  for (const group of groupRenamesByValue(plan.renames)) {
    try {
      await products.updateProductOptionValues({ id: group.option_value_ids }, { value: group.value });
      result.renamed += group.option_value_ids.length;
    } catch (error) {
      result.errors.push(
        `No se pudo renombrar ${group.option_value_ids.length} valor(es) de opción a "${group.value}": ${truncateError(error)}`
      );
    }
  }
  for (const rename of plan.renames) result.touchedProductIds.add(rename.product_id);

  // Los títulos de variante, agrupados igual.
  const titlesByValue = new Map<string, string[]>();
  for (const item of plan.variant_titles) {
    const bucket = titlesByValue.get(item.to) ?? [];
    bucket.push(item.variant_id);
    titlesByValue.set(item.to, bucket);
  }
  for (const [title, variantIds] of titlesByValue) {
    for (let i = 0; i < variantIds.length; i += TITLE_CHUNK) {
      const chunk = variantIds.slice(i, i + TITLE_CHUNK);
      try {
        await products.updateProductVariants({ id: chunk }, { title });
        result.titles_updated += chunk.length;
      } catch (error) {
        result.errors.push(
          `No se pudo poner el título "${title}" en ${chunk.length} variante(s): ${truncateError(error)}`
        );
      }
    }
  }

  return result;
}
