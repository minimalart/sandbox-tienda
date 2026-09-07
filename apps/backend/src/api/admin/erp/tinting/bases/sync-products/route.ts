import type { Logger } from '@medusajs/framework/types';
import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { createProductsWorkflow, updateProductsWorkflow } from '@medusajs/medusa/core-flows';
import { siteFromRequest } from '../../../../../../lib/multistore/request';
import { ERP_MODULE } from '../../../../../../modules/erp';
import type ErpModuleService from '../../../../../../modules/erp/service';
import type { TintingFormulaRow } from '../../../../../../modules/erp/service';
import { getErpAdapter } from '../../../../../../modules/erp/adapters/registry';
import { buildBaseCardMetadata } from '../../../../../../modules/erp/tinting/base-card-metadata';
import {
  baseHandleSeed,
  formulaKeyOf,
  planBaseProducts,
} from '../../../../../../modules/erp/tinting/plan-base-products';
import {
  normalizePresentationLabel,
  resolveTitleRules,
  titleRulesFingerprint,
} from '../../../../../../modules/erp/sync/product-title';
import {
  applyPresentationOptions,
  readPresentationState,
} from '../../../../../../modules/erp/sync/apply-presentation-option';
import { planPresentationOptions } from '../../../../../../modules/erp/sync/presentation-option';
import { DEFAULT_CATALOG_SYNC_SETTINGS } from '../../../../../../modules/erp/types';
import type { ErpConfigSettings } from '../../../../../../modules/erp/types';
import type { PostErpTintingSyncProductsType } from '../../../validators';
import { resolveTintingReadiness } from '../../../../../../modules/erp/tinting/readiness';

/**
 * Etiqueta de presentación de la base, con la MISMA forma que el título
 * normalizado. `size_label` sale de parsear el título crudo de Zeus, así que
 * viene `3,6 LTS`: escribirlo tal cual dejaba la card diciendo "3,6 LTS" al lado
 * de un título que dice "x4 lt".
 *
 * `tintBase: true` no es opcional acá: todo lo que pasa por esta ruta ES una base
 * entonable, así que el envase va redondeado (R25) igual que en el título.
 */
const presentationOf = (item: { size_label?: string | null }): string =>
  normalizePresentationLabel(item.size_label, { tintBase: true }) ??
  item.size_label?.trim() ??
  'Único';

/**
 * POST /admin/erp/tinting/bases/sync-products — crea en Medusa las bases
 * entonables del ERP que todavía no existen.
 *
 * Zeus marca las bases con `publica_en_ecommerce: "2"`, un flag que comparten
 * 752 artículos de los cuales sólo ~134 son bases (el resto son pinceles,
 * `MODIFICA DESCRIPCIÓN`, `Descuento`). Por eso NO se afloja el filtro del
 * catalog sync: acá se crea únicamente lo que el detector reconoce como base, y
 * el flag de publicación del ERP se ignora a propósito.
 *
 * Regla de publicación: `published` sólo si la línea+letra ya tiene fórmulas
 * cargadas; el resto entra en `draft` y se publica cuando su carta se valide.
 *
 * Arranca en dry run: sin `dry_run: false` devuelve el plan sin escribir.
 */
export async function POST(
  req: MedusaRequest<PostErpTintingSyncProductsType>,
  res: MedusaResponse
): Promise<void> {
  const body = req.validatedBody;
  const service = req.scope.resolve<ErpModuleService>(ERP_MODULE);
  const logger = req.scope.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  /**
   * El ERP es UNO por instalación y sus bases son del catálogo de la instalación —
   * eso ya está declarado en `admin/erp/tinting` y no cambia—. Lo que SÍ tiene eje
   * de tienda es el único parámetro que decide dónde se venden: `sales_channel_ids`
   * viene del BODY y no se chequeaba contra nada, así que desde una tienda
   * secundaria se podía dar de alta producto DIRECTO en el canal de la principal.
   *
   * Se valida y no se sobrescribe: acá `siteDefaults` sería el error que este
   * repaso existe para no cometer. La elección de canales es del operador —una base
   * puede ir a dos canales a propósito— y pisarla con el primario de la tienda
   * convertiría un alta multi-canal en una de un canal sin decir nada.
   *
   * Va ANTES del dry run a propósito: un plan que promete un canal que el apply va
   * a rechazar es peor que no tener plan.
   */
  const resolution = await siteFromRequest(req);
  if (resolution.status === 'site' && body.sales_channel_ids?.length) {
    const own = new Set(resolution.site.channel_ids);
    const foreign = body.sales_channel_ids.filter((id) => !own.has(id));
    if (foreign.length) {
      res.status(404).json({
        // No dice cuáles ni de quién son: un mensaje detallado confirmaría qué
        // canales existen en otra tienda. Mismo criterio que el 404 de
        // `assertIdInSite`.
        message: 'Alguno de los canales indicados no existe o no es de la tienda activa.',
      });
      return;
    }
  }

  const config = await service.getActiveConfig();
  if (!config) {
    res.status(400).json({ message: 'La extensión ERP no está configurada o está deshabilitada.' });
    return;
  }
  const adapter = getErpAdapter(config.provider);
  if (!adapter.getCatalogChanges) {
    res.status(400).json({ message: `El ERP ${config.provider} no expone catálogo.` });
    return;
  }
  const credentials = service.getDecryptedCredentials(config);
  if (!credentials) {
    res.status(400).json({ message: 'No hay credenciales del ERP guardadas.' });
    return;
  }

  const settings = (config.settings ?? {}) as ErpConfigSettings;
  const baseListIndex =
    settings.catalog_sync?.base_list_index ?? DEFAULT_CATALOG_SYNC_SETTINGS.base_list_index;
  /**
   * Las MISMAS reglas que el catalog sync, leídas del mismo lugar: el título de
   * una base no es un caso aparte del de cualquier otro artículo del ERP, y si
   * el operador apaga la normalización tiene que apagarse acá también.
   */
  const titleRules = (settings.catalog_sync?.title_rules?.enabled ?? true)
    ? resolveTitleRules(settings.catalog_sync?.title_rules)
    : null;

  // ── Catálogo del ERP ──────────────────────────────────────────────────────
  let rows;
  try {
    rows = await adapter.getCatalogChanges(null, {
      credentials,
      settings: settings as unknown as Record<string, unknown>,
      countryCode: config.country_code,
      logger,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    res.status(424).json({ message: `No pudimos leer el catálogo del ERP: ${detail}` });
    return;
  }

  // ── SKUs que ya existen en Medusa (barrido paginado, sin tope silencioso) ──
  const existingSkus = new Set<string>();
  const PAGE = 1_000;
  for (let page = 0; page < 200; page += 1) {
    const { data } = (await query.graph({
      entity: 'product_variant',
      fields: ['sku'],
      pagination: { take: PAGE, skip: page * PAGE, order: { id: 'ASC' } },
    })) as { data: Array<{ sku?: string | null }> };
    for (const variant of data) {
      const sku = variant.sku?.trim();
      if (sku) existingSkus.add(sku);
    }
    if (data.length < PAGE) break;
  }

  // ── Qué líneas+letras ya tienen colores validados ─────────────────────────
  const formulas = (await service.listErpTintingFormulas(
    { active: true },
    { take: null }
  )) as unknown as TintingFormulaRow[];
  const formulaKeys = new Set(formulas.map((f) => formulaKeyOf(f.product_line, f.base_letter)));

  const plan = planBaseProducts({ rows, existingSkus, formulaKeys, baseListIndex, titleRules });
  const dryRun = body.dry_run !== false;

  const skipCounts: Record<string, number> = {};
  for (const skip of plan.skips) skipCounts[skip.reason] = (skipCounts[skip.reason] ?? 0) + 1;

  const summary = {
    dry_run: dryRun,
    erp_rows: rows.length,
    to_create: plan.creates.length,
    publishable: plan.publishable,
    draft: plan.creates.length - plan.publishable,
    skipped: skipCounts,
  };

  if (dryRun) {
    res.json({
      ...summary,
      items: plan.creates.map((c) => ({
        sku: c.sku,
        title: c.title,
        // Los dos títulos en el dry run: el plan tiene que dejar ver QUÉ le hizo
        // la normalización al nombre antes de escribirlo en la tienda.
        source_title: c.source_title,
        base_letter: c.base_letter,
        size_label: c.size_label,
        price: c.price,
        status: c.status,
      })),
    });
    return;
  }

  /**
   * Metadata de card para lo que se está por crear. Se calcula ACÁ y no en una
   * segunda pasada: las fórmulas ya están en la mano y los valores entran en el
   * mismo `createProducts`, así que no cuesta ni una llamada más.
   *
   * Sin esto el alta dejaba los productos sin "+n colores" ni círculos y sólo el
   * PATCH los arreglaba — un segundo paso que nada obligaba a dar. Ver
   * `base-card-metadata.ts`.
   */
  const cardMetadata = buildBaseCardMetadata({
    bases: plan.creates.map((c) => ({
      article_code: c.sku,
      product_line: c.product_line,
      base_letter: c.base_letter,
    })),
    formulas,
    colors: (await service.listErpTintingColors(
      { active: true },
      { take: null, order: { rank: 'ASC', name: 'ASC' } }
    )) as unknown as Array<{ code: string; collection: string; hex: string | null }>,
  });

  // ── Alta ──────────────────────────────────────────────────────────────────
  const salesChannelIds = body.sales_channel_ids ?? [];
  const shippingProfileId =
    body.shipping_profile_id ?? settings.catalog_sync?.shipping_profile_id ?? null;
  const currencyCode =
    settings.catalog_sync?.currency_code ?? DEFAULT_CATALOG_SYNC_SETTINGS.currency_code;

  // El árbol de categorías del ERP ya está espejado con `external_id`, así que la
  // categoría sale de ahí sin volver a pedirla.
  const { data: categories } = (await query.graph({
    entity: 'product_category',
    fields: ['id', 'external_id'],
    pagination: { take: 1_000, skip: 0 },
  })) as { data: Array<{ id: string; external_id?: string | null }> };
  const categoryIdByCode = new Map<string, string>();
  for (const category of categories) {
    const code = category.external_id?.startsWith(`${config.provider}:`)
      ? category.external_id.slice(config.provider.length + 1)
      : null;
    if (code) categoryIdByCode.set(code.toUpperCase(), category.id);
  }

  const created: Array<{ sku: string; product_id: string; status: string }> = [];
  const failed: Array<{ sku: string; error: string }> = [];

  for (const item of plan.creates) {
    try {
      const categoryId = item.category_code
        ? (settings.catalog_sync?.category_map?.[item.category_code] ??
          categoryIdByCode.get(item.category_code.toUpperCase()) ??
          null)
        : null;

      const { result } = await createProductsWorkflow(req.scope).run({
        input: {
          products: [
            {
              title: item.title,
              handle: baseHandleSeed(item.title, item.sku),
              ...(item.description ? { description: item.description } : {}),
              status: item.status,
              ...(shippingProfileId ? { shipping_profile_id: shippingProfileId } : {}),
              ...(categoryId ? { categories: [{ id: categoryId }] } : {}),
              ...(salesChannelIds.length
                ? { sales_channels: salesChannelIds.map((id) => ({ id })) }
                : {}),
              ...(item.weight !== null ? { weight: item.weight } : {}),
              // La presentación es la única opción real de una base: el color no
              // es una opción de Medusa (sería un producto por color).
              options: [{ title: 'Presentación', values: [presentationOf(item)] }],
              variants: [
                {
                  title: presentationOf(item),
                  sku: item.sku,
                  // Sin inventario gestionado: el stock de estas bases lo maneja
                  // el ERP y el stock sync todavía no tiene el mapeo de depósitos.
                  manage_inventory: false,
                  options: { 'Presentación': presentationOf(item) },
                  prices: [{ amount: item.price!, currency_code: currencyCode }],
                  metadata: {
                    source: config.provider,
                    source_product_id: item.sku,
                    tinting_base: true,
                    // Misma trazabilidad que el catalog sync (`zeus_source_title`
                    // / `zeus_title_rules_v`, en la variante): es lo que permite
                    // recalcular el título cuando sube `TITLE_RULES_VERSION` sin
                    // volver a pedirle el catálogo al ERP.
                    zeus_source_title: item.source_title,
                    ...(titleRules ? { zeus_title_rules_v: titleRulesFingerprint(titleRules) } : {}),
                    // Sin esto la base nace fuera del alcance de
                    // `planPresentationOptions`, que lee la presentación de acá:
                    // su chip queda congelado en la etiqueta del alta y ni
                    // siquiera un cambio de R25 lo alcanza (DESDEELSUR-34).
                    zeus_presentacion: presentationOf(item),
                  },
                },
              ],
              metadata: {
                source: config.provider,
                tintable: true,
                // Sin `tint_optional`: el POST crea bases que el detector sacó
                // del catálogo del ERP, y ésas nunca son un producto terminado.
                // El blanco que además hace de base ya existe en Medusa (entra
                // por `already_in_medusa`) y lo marca el PATCH.
                tint_base_letter: item.base_letter,
                tint_product_line: item.product_line,
                // Lo que lee la card del listado. Una base sin fórmulas no entra
                // en el mapa y queda sin conteo, que es lo correcto: nace en
                // `draft` y el PATCH la completa cuando su carta llegue.
                ...(cardMetadata.get(item.sku)
                  ? {
                      tint_color_count: cardMetadata.get(item.sku)!.count,
                      tint_swatches: cardMetadata.get(item.sku)!.swatches,
                    }
                  : {}),
                ...(body.collection ? { tint_collection: body.collection } : {}),
              },
            } as never,
          ],
        },
      });

      const product = (result as Array<{ id: string }>)[0];
      if (!product?.id) {
        failed.push({ sku: item.sku, error: 'La creación no devolvió id.' });
        continue;
      }
      created.push({ sku: item.sku, product_id: product.id, status: item.status });
    } catch (error) {
      failed.push({ sku: item.sku, error: error instanceof Error ? error.message : String(error) });
    }
  }

  // Las bases creadas quedan registradas y CONFIRMADAS: que el artículo exista en
  // Medusa por decisión de esta ruta ya es la confirmación humana.
  if (created.length) {
    await service.upsertTintingBases(
      plan.creates
        .filter((c) => created.some((x) => x.sku === c.sku))
        .map((c) => ({
          article_code: c.sku,
          base_letter: c.base_letter,
          product_line: c.product_line,
          collection: body.collection ?? null,
          size_label: c.size_label,
          size_liters: c.size_liters,
          source: 'erp' as const,
          // El CRUDO, igual que en `bases/detect`: `title_snapshot` es la foto de
          // lo que dice Zeus, no del nombre que muestra la tienda.
          title_snapshot: c.source_title,
        })),
      { confirmOnCreate: true }
    );
  }

  logger.info(
    `[erp] tintométrico: ${created.length} bases creadas (${plan.publishable} publicadas), ${failed.length} fallidas.`
  );

  res.json({
    ...summary,
    created,
    failed,
    readiness: await resolveTintingReadiness(req.scope, service),
  });
}

/**
 * PATCH — publica las bases que ya tienen colores validados y estaban en
 * borrador. Es el segundo paso del ciclo: se importan colores + fórmulas de una
 * base nueva y esto la pone a la venta sin tener que buscarla a mano.
 */
export async function PATCH(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<ErpModuleService>(ERP_MODULE);
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const logger = req.scope.resolve<Logger>(ContainerRegistrationKeys.LOGGER);

  const bases = (await service.listErpTintingBases(
    { active: true, confirmed: true },
    { take: null }
  )) as unknown as Array<{
    article_code: string;
    product_line: string;
    base_letter: string | null;
    sellable_untinted?: boolean;
  }>;
  const formulas = (await service.listErpTintingFormulas(
    { active: true },
    { take: null }
  )) as unknown as TintingFormulaRow[];
  const formulaKeys = new Set(formulas.map((f) => formulaKeyOf(f.product_line, f.base_letter)));

  const ready = bases.filter((b) => formulaKeys.has(formulaKeyOf(b.product_line, b.base_letter)));
  if (!ready.length) {
    res.json({ published: 0, message: 'Ninguna base en borrador tiene colores validados.' });
    return;
  }

  const { data: variants } = (await query.graph({
    entity: 'product_variant',
    fields: ['sku', 'product.id', 'product.status'],
    filters: { sku: ready.map((b) => b.article_code) },
  })) as { data: Array<{ sku?: string | null; product?: { id: string; status: string } | null }> };

  // ── Metadata que consume la card del listado ──────────────────────────────
  //
  // Se refresca acá porque este es el momento en que la carta de una base cambió.
  // El cálculo es el MISMO que usa el alta (`base-card-metadata.ts`): si las dos
  // rutas divergieran, crear y refrescar darían conteos distintos para la misma
  // base y nadie se enteraría.
  const metadataBySku = buildBaseCardMetadata({
    bases: ready,
    formulas,
    colors: (await service.listErpTintingColors(
      { active: true },
      { take: null, order: { rank: 'ASC', name: 'ASC' } }
    )) as unknown as Array<{ code: string; collection: string; hex: string | null }>,
  });

  const toPublish = [
    ...new Set(
      variants
        .filter((v) => v.product && v.product.status !== 'published')
        .map((v) => v.product!.id)
    ),
  ];

  // La metadata se refresca SIEMPRE, incluso si ya estaban publicadas: es lo que
  // cambia cuando se importan colores nuevos a una base que ya estaba a la venta.
  // El PDP lee `tint_optional` del producto para el PRIMER render, antes de que
  // `/store/tinting/colors` conteste. Sin él, el blanco que además hace de base
  // aparece con el botón de comprar bloqueado hasta que vuelve el fetch — que es
  // justo lo que la doble función no puede permitirse.
  const optionalBySku = new Map(ready.map((b) => [b.article_code, Boolean(b.sellable_untinted)]));

  let metadataUpdated = 0;
  for (const variant of variants) {
    const sku = variant.sku?.trim();
    const productId = variant.product?.id;
    if (!sku || !productId) continue;
    const meta = metadataBySku.get(sku);
    if (!meta) continue;
    await updateProductsWorkflow(req.scope).run({
      input: {
        selector: { id: [productId] },
        update: {
          metadata: {
            tintable: true,
            tint_optional: optionalBySku.get(sku) ?? false,
            tint_color_count: meta.count,
            tint_swatches: meta.swatches,
          },
          ...(toPublish.includes(productId) ? { status: 'published' as const } : {}),
        },
      },
    });
    metadataUpdated += 1;
  }

  /**
   * Etiqueta de presentación de las bases que YA existen.
   *
   * Va acá y no en el catalog sync porque el catalog sync no las trae: Zeus las
   * marca con `publica_en_ecommerce: "2"` y quedan fuera de su barrido, así que
   * la fase de presentación nunca las mira. Este PATCH es el único momento del
   * ciclo que las tiene todas juntas.
   *
   * La decisión la toma `planPresentationOptions`, la MISMA función que usa el
   * catalog sync: sólo pisa un placeholder o la misma medida escrita distinto, y
   * nunca una etiqueta que alguien escribió a mano. Es lo que corrige las 19
   * bases de 17,4 L que muestran `18 lt` debajo de un título que dice `x20 lt`
   * (DESDEELSUR-23 reescribió el título y dejó el chip atrás).
   */
  const presentationPlan = planPresentationOptions(
    await readPresentationState(
      req.scope,
      ready.map((base) => base.article_code)
    )
  );
  const presentation = await applyPresentationOptions(req.scope, presentationPlan);
  for (const productId of presentation.touchedProductIds) {
    if (!toPublish.includes(productId)) metadataUpdated += 1;
  }
  for (const error of presentation.errors) logger.error(`[erp] tintométrico: ${error}`);

  res.json({
    published: toPublish.length,
    metadata_updated: metadataUpdated,
    presentation_renamed: presentation.renamed,
    presentation_titles_updated: presentation.titles_updated,
    product_ids: toPublish,
    // Los productos tocados hay que reindexar en Typesense para que la card vea
    // los swatches: el índice no se entera solo.
    reindex_required: metadataUpdated > 0 || presentation.renamed > 0,
  });
}
