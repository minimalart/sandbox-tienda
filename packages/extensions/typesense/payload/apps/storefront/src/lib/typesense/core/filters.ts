// Construcción de filtros para búsquedas Typesense.
// Lee `process.env.NEXT_PUBLIC_SALES_CHANNEL_ID` como fallback —
// variable pública, inlined en build time, segura para el browser.

import type { TypesenseProductsParams } from "../types";

export const quoteFilterValue = (value: string) =>
  `\`${value.replace(/`/g, "\\`")}\``;

// Filtros que definen qué productos pertenecen al catálogo del storefront.
// Se aplican TANTO a la query de resultados listados COMO a la query de
// facet-universe, para que los usuarios nunca vean conteos de facetas para
// productos que no existen en la tienda (canal incorrecto, sin precio,
// hidden_from_store, etc.).
export function buildBaseFilterBy(params: TypesenseProductsParams): string {
  const filters: string[] = [];
  const quote = quoteFilterValue;

  if (!params.omitPriceFilter) {
    filters.push("price:>0");
  }

  // Restringir a un canal de ventas solo cuando hay uno configurado —
  // el param explícito gana, luego NEXT_PUBLIC_SALES_CHANNEL_ID, si no hay ninguno sin filtro de canal.
  const salesChannelId =
    params.salesChannelId || process.env.NEXT_PUBLIC_SALES_CHANNEL_ID;
  if (salesChannelId) {
    filters.push(`sales_channels.id:=${quote(salesChannelId)}`);
  }

  if (params.productIds?.length) {
    filters.push(`id:=[${params.productIds.map(quote).join(",")}]`);
  } else {
    // Ocultar productos marcados como no-para-storefront en listados genéricos
    // (PLP/búsqueda/relacionados). Cuando el caller pide IDs específicos (ej. el
    // flujo de auto-add del carrito resolviendo el regalo por id), confiamos en
    // ellos y saltamos el filtro — de lo contrario el auto-add no encontraría el
    // producto regalo oculto.
    filters.push("metadata.hidden_from_store:!=true");
  }

  return filters.join(" && ");
}

// Filtros seleccionables por el usuario desde el panel de refinamiento del PLP
// (categoría, marca, rango de precio, fragancia, etc.). Excluidos de la query
// de facet-universe para que la barra lateral siga mostrando OTROS valores que
// el usuario podría combinar con su selección actual.
export function buildUserFilterBy(
  params: TypesenseProductsParams,
  schemaFields?: Set<string>,
): string {
  const filters: string[] = [];
  const quote = quoteFilterValue;

  if (params.categoryNames?.length) {
    filters.push(
      `categories.name:=[${params.categoryNames.map(quote).join(",")}]`,
    );
  }
  if (params.categoryId) {
    filters.push(`categories.id:=${quote(params.categoryId)}`);
  } else if (params.category) {
    filters.push(`categories.name:=${quote(params.category)}`);
  }

  if (params.collectionId) {
    filters.push(`collection.id:=${quote(params.collectionId)}`);
  } else if (params.collection) {
    filters.push(`collection.title:=${quote(params.collection)}`);
  }

  if (params.brand) {
    filters.push(`brand.name:=${quote(params.brand)}`);
  }

  // Familia del ERP: ortogonal a la categoría (una familia cruza varias
  // categorías). Misma forma que `brand`, a propósito.
  if (params.family) {
    filters.push(`family.name:=${quote(params.family)}`);
  }

  if (params.tags?.length) {
    const tagFilters = params.tags
      .map((tag) => `tags.value:=${quote(tag)}`)
      .join(" || ");
    filters.push(`(${tagFilters})`);
  } else if (params.tag) {
    filters.push(`tags.value:=${quote(params.tag)}`);
  }

  if (params.priceMin != null) {
    filters.push(`price:>=${params.priceMin}`);
  }
  if (params.priceMax != null) {
    filters.push(`price:<=${params.priceMax}`);
  }

  if (params.promotion) {
    filters.push(`promotions.campaign.name:=${quote(params.promotion)}`);
  }

  // Generic promo filter: any product carrying an active promotion.
  if (params.onlyPromotions) {
    filters.push("has_promotion:=true");
  }

  const hasField = (f: string) =>
    !schemaFields || schemaFields.size === 0 || schemaFields.has(f);

  if (params.fragancia && hasField("fragrance.name")) {
    filters.push(`fragrance.name:=${quote(params.fragancia)}`);
  }
  if (params.sugerenciaUso && hasField("usage_suggestion.name")) {
    filters.push(`usage_suggestion.name:=${quote(params.sugerenciaUso)}`);
  }
  if (params.familiaOlfativa && hasField("olfactory_family.name")) {
    filters.push(`olfactory_family.name:=${quote(params.familiaOlfativa)}`);
  }

  // Atributos del asesor. No van tras `hasField`: los declara `schema.ts` para
  // TODA colección, así que la faceta existe aunque el catálogo no tenga valores
  // (responde con total_values:0, no con 404) — igual que
  // `promotions.campaign.name`.
  //
  // La superficie se EXPANDE a multisuperficie, como en el filtrado guiado
  // (§12): un esmalte multisuperficie sirve para madera, así que filtrar por
  // "Madera" sin incluirlo escondería productos válidos. El plástico NO expande
  // a propósito: la mayoría de las pinturas no adhieren al plástico sin
  // imprimación, y el PRD pide sólo los multisuperficie marcados como aptos.
  if (params.advisorSurface) {
    const values =
      params.advisorSurface === "multi" || params.advisorSurface === "plastic"
        ? [params.advisorSurface]
        : [params.advisorSurface, "multi"];
    filters.push(`advisor_surface:=[${values.map(quote).join(",")}]`);
  }
  if (params.advisorProductType) {
    filters.push(`advisor_product_type:=${quote(params.advisorProductType)}`);
  }
  if (params.advisorEnvironment) {
    filters.push(`advisor_environment:=${quote(params.advisorEnvironment)}`);
  }
  if (params.advisorSpecialUse) {
    filters.push(`advisor_special_use:=${quote(params.advisorSpecialUse)}`);
  }
  if (params.advisorBase) {
    filters.push(`advisor_base:=${quote(params.advisorBase)}`);
  }

  if (params.erpSubcategoryId) {
    filters.push(`metadata.erp_subcategory_id:=${params.erpSubcategoryId}`);
  }

  return filters.join(" && ");
}
