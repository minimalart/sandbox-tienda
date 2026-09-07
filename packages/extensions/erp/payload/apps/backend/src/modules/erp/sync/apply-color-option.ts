import type { MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import { truncateError } from '../sanitize';
import { isColorOptionTitle, type ColorPlan, type ColorProductState } from './color-option';

/**
 * Lado de LECTURA y ESCRITURA de la opción de color. La decisión la toma
 * `planColorOptions` (pura); acá solo se lee el estado y se aplica.
 *
 * Agregarle una option a un producto que YA tiene variantes son TRES pasos, y los
 * tres son obligatorios. Costó dos intentos fallidos contra producción llegar acá,
 * así que vale dejar escrito por qué es cada uno:
 *
 *  1. `createProductOptions([{title, values}])` crea la option y su valor, y NADA
 *     más. **`CreateProductOptionDTO` no tiene `product_id`**: pasárselo (como
 *     hacían las dos versiones anteriores) no falla, Medusa lo ignora en silencio
 *     y la option queda suelta, sin dueño.
 *  2. `addProductOptionToProduct({product_id, product_option_id})` es el que la
 *     asocia — y de paso linkea TODOS sus valores, porque
 *     `product_option_value_ids` omitido significa "todos". Este solo paso cubre
 *     el link option↔producto Y el pivot de valores permitidos.
 *     `updateProductOptionValuesOnProduct` NO sirve para esto: exige que el par
 *     ya exista y tira "Some product options are not linked to products".
 *  3. `updateProductVariants(id, {options})` engancha la variante — y el payload
 *     tiene que traer un valor para CADA option del producto, no solo el nuevo:
 *     `assignOptionsToVariants` compara `productsOptions.length` contra las
 *     claves recibidas y tira "Product has N option values but there were M
 *     provided". Por eso el plan arrastra las options actuales de la variante.
 *
 * Si algo falla se borra la option recién creada: una variante sin valor para una
 * option del producto es un estado inválido que rompe el PDP y el add-to-cart.
 *
 * Va por el módulo de producto y no por workflows por la misma razón que el resto
 * del motor: los workflows emiten `product.updated` por producto y eso dispara un
 * reindex de Typesense por producto.
 */

const READ_CHUNK = 200;
export const COLOR_OPTION_TITLE = 'Color';
/**
 * Fallos consecutivos sin UN solo éxito que abortan la fase.
 *
 * Existe por experiencia propia: una versión con un supuesto equivocado sobre la
 * API de Medusa falló 1.502 veces seguidas contra producción antes de terminar.
 * Si los primeros intentos fallan todos, el supuesto está mal y seguir sólo suma
 * ruido — mejor abortar y dejar un warning que se pueda leer.
 */
const ABORT_AFTER_CONSECUTIVE_FAILURES = 5;

type ProductOptionWriter = {
  /** OJO: no acepta `product_id`. La option nace suelta (ver el paso 2). */
  createProductOptions(
    data: Array<{ title: string; values: string[]; is_exclusive?: boolean }>
  ): Promise<Array<{ id: string }>>;
  addProductOptionToProduct(pair: {
    product_id: string;
    product_option_id: string;
  }): Promise<{ id: string }>;
  deleteProductOptions(ids: string[]): Promise<unknown>;
  updateProductVariants(id: string, data: { options: Record<string, string> }): Promise<unknown>;
  /**
   * Renombre IN SITU del valor: conserva el id, así que el link con la variante
   * no se toca. Es el mismo mecanismo que usa `applyPresentationOptions`.
   */
  updateProductOptionValues(selector: { id: string[] }, data: { value: string }): Promise<unknown>;
};

/** Estado de color de los productos que matchean los códigos del ERP. */
export async function readColorState(
  container: MedusaContainer,
  codes: string[]
): Promise<ColorProductState[]> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const byProduct = new Map<string, ColorProductState>();
  if (!codes.length) return [];

  type VariantOption = { value: string | null; option?: { title: string | null } | null };
  type ProductOption = {
    title: string | null;
    values?: Array<{ id: string; value: string | null }> | null;
  };
  type Row = {
    id: string;
    sku: string | null;
    metadata: Record<string, unknown> | null;
    product_id: string | null;
    options?: VariantOption[] | null;
    product?: {
      id: string;
      variants?: Array<{ id: string; options?: VariantOption[] | null }> | null;
      options?: ProductOption[] | null;
    } | null;
  };

  const optionMap = (options: VariantOption[] | null | undefined): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const option of options ?? []) {
      const title = option.option?.title;
      if (title && option.value !== null && option.value !== undefined) out[title] = option.value;
    }
    return out;
  };

  for (let i = 0; i < codes.length; i += READ_CHUNK) {
    const chunk = codes.slice(i, i + READ_CHUNK);
    const { data: variants } = (await query.graph({
      entity: 'product_variant',
      fields: [
        'id',
        'sku',
        'metadata',
        'product_id',
        'options.value',
        'options.option.title',
        'product.id',
        'product.options.title',
        // Para corregir la ortografía de una etiqueta de color ya escrita hace
        // falta el id del valor: el renombre es in situ.
        'product.options.values.id',
        'product.options.values.value',
        'product.variants.id',
        'product.variants.options.value',
        'product.variants.options.option.title',
      ],
      filters: { sku: chunk },
    })) as { data: Row[] };

    for (const variant of variants) {
      const productId = variant.product?.id ?? variant.product_id;
      if (!productId || byProduct.has(productId)) continue;
      const color = variant.metadata?.zeus_color;
      byProduct.set(productId, {
        product_id: productId,
        option_titles: (variant.product?.options ?? [])
          .map((option) => option.title ?? '')
          .filter(Boolean),
        color_option_values: (variant.product?.options ?? [])
          .filter((option) => isColorOptionTitle(option.title))
          .flatMap((option) =>
            (option.values ?? []).map((value) => ({
              option_value_id: value.id,
              value: value.value,
            }))
          ),
        variants: (variant.product?.variants ?? [{ id: variant.id, options: variant.options }]).map(
          (row) => ({
            variant_id: row.id,
            // El color solo se conoce de la variante que matcheó el SKU.
            color: row.id === variant.id && typeof color === 'string' ? color : null,
            options: optionMap(row.id === variant.id ? (row.options ?? variant.options) : row.options),
          })
        ),
      });
    }
  }
  return [...byProduct.values()];
}

export type ColorApplyResult = {
  created: number;
  /** Etiquetas de color corregidas in situ (`Marron` → `Marrón`). */
  renamed: number;
  touchedProductIds: Set<string>;
  errors: string[];
  /** La fase se cortó por fallos consecutivos: quedó trabajo sin intentar. */
  aborted: boolean;
};

/** Aplica el plan. Nunca lanza: los fallos vuelven en `errors`. */
export async function applyColorOptions(
  container: MedusaContainer,
  plan: ColorPlan
): Promise<ColorApplyResult> {
  const result: ColorApplyResult = {
    created: 0,
    renamed: 0,
    touchedProductIds: new Set(),
    errors: [],
    aborted: false,
  };
  if (!plan.creates.length && !plan.renames.length) return result;

  const products = container.resolve(Modules.PRODUCT) as unknown as ProductOptionWriter;
  let consecutiveFailures = 0;

  // Correcciones de ortografía primero: son un update por valor destino y no
  // dependen de nada de lo de abajo. Agrupadas, N productos que van a "Marrón"
  // son UNA llamada.
  const renamesByValue = new Map<string, string[]>();
  for (const rename of plan.renames) {
    const bucket = renamesByValue.get(rename.to) ?? [];
    bucket.push(rename.option_value_id);
    renamesByValue.set(rename.to, bucket);
    result.touchedProductIds.add(rename.product_id);
  }
  for (const [value, optionValueIds] of renamesByValue) {
    try {
      await products.updateProductOptionValues({ id: optionValueIds }, { value });
      result.renamed += optionValueIds.length;
    } catch (error) {
      result.errors.push(
        `No se pudo corregir ${optionValueIds.length} etiqueta(s) de color a "${value}": ${truncateError(error)}`
      );
    }
  }

  for (const item of plan.creates) {
    if (result.created === 0 && consecutiveFailures >= ABORT_AFTER_CONSECUTIVE_FAILURES) {
      result.aborted = true;
      result.errors.push(
        `La opción de color se abortó después de ${consecutiveFailures} fallos consecutivos sin ` +
          `ningún éxito: quedaron ${plan.creates.length - consecutiveFailures} producto(s) sin ` +
          'intentar. Revisá el primer error antes de volver a correr.'
      );
      break;
    }

    let optionId: string | null = null;
    try {
      // Paso 1: la option nace suelta. `is_exclusive` porque es de este producto,
      // igual que el `Formato` que crea el alta del catálogo.
      const [option] = await products.createProductOptions([
        { title: COLOR_OPTION_TITLE, values: [item.color], is_exclusive: true },
      ]);
      optionId = option?.id ?? null;
      if (!optionId) throw new Error('createProductOptions no devolvió id.');

      // Paso 2: asociarla al producto. Sin `product_option_value_ids` linkea todos
      // sus valores, que es justo lo que hace falta (la option tiene uno solo).
      await products.addProductOptionToProduct({
        product_id: item.product_id,
        product_option_id: optionId,
      });

      // Paso 3: TODAS las options de la variante, no sólo la nueva.
      await products.updateProductVariants(item.variant_id, {
        options: { ...item.options, [COLOR_OPTION_TITLE]: item.color },
      });

      result.created += 1;
      result.touchedProductIds.add(item.product_id);
      consecutiveFailures = 0;
    } catch (error) {
      consecutiveFailures += 1;
      result.errors.push(`No se pudo poner el color "${item.color}" en ${item.product_id}: ${truncateError(error)}`);
      // Rollback: una option sin la variante enganchada deja el producto roto.
      if (optionId) {
        await products
          .deleteProductOptions([optionId])
          .catch((cleanupError) =>
            result.errors.push(
              `Además quedó una opción de color huérfana en ${item.product_id} ` +
                `(${truncateError(cleanupError)}); hay que borrarla a mano.`
            )
          );
      }
    }
  }

  return result;
}
