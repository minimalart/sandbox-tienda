/**
 * Renombra las bases entonables que quedaron con el título CRUDO del ERP.
 *
 * Por qué existe: `admin/erp/tinting/bases/sync-products` es la segunda puerta de
 * entrada de productos del ERP y hasta DESDEELSUR-13 copiaba el título literal de
 * Zeus (`REVEAR - MARBLE COLOR BASE T X 3,6 LTS`) mientras el catalog sync
 * normalizaba el suyo. El resultado en la tienda era el del ticket: un listado
 * con la mitad de los nombres en MAYÚSCULAS. La ruta ya está arreglada, pero las
 * bases que se crearon ANTES siguen con el nombre viejo, y como el catalog sync
 * las excluye a propósito (`publica_en_ecommerce: "2"`) nadie las va a tocar.
 *
 * Cómo decide el nombre: vuelve a pedirle el catálogo COMPLETO al ERP y pasa el
 * título crudo por `normalizeBaseTitle`, la misma función que usa la ruta. No se
 * recalcula desde el título guardado en Medusa: la normalización necesita la
 * MARCA del artículo para poder sacarla del nombre (sin `brand`,
 * `REVEAR - MARBLE COLOR…` termina en `Revear marble color x4 lt` en vez de
 * `Marble color x4 lt`), y esa marca sólo la tiene el ERP.
 *
 * Y con el título va el CHIP: la card del PLP no pinta el título sino el valor de
 * la option de presentación, y ese lo reconcilia el catalog sync sólo sobre los
 * SKU que el ERP trajo en la corrida. Las bases no entran ahí
 * (`publica_en_ecommerce: "2"`), así que su chip esperaba al barrido completo de
 * las 04:00 y quedaba contradiciendo al título recién escrito durante horas
 * (DESDEELSUR-27). Se reconcilia acá, en la misma pasada.
 *
 * Es idempotente: `normalizeProductTitle` es una función pura del dato del ERP y
 * ya normalizado da lo mismo, así que una segunda corrida no propone nada. Sólo
 * toca productos cuyo título DIFIERE del que corresponde — una corrección hecha
 * a mano en el admin que ya esté normalizada no se pisa.
 *
 * Arranca en DRY RUN. Para escribir:
 *   pnpm tinting:backfill-base-titles        # plan, no escribe
 *   pnpm tinting:backfill-base-titles:apply  # escribe
 */
import type { ExecArgs } from '@medusajs/framework/types';
import type { Logger } from '@medusajs/framework/types';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import { updateProductVariantsWorkflow } from '@medusajs/medusa/core-flows';
import { ERP_MODULE } from '../modules/erp';
import type ErpModuleService from '../modules/erp/service';
import { getErpAdapter } from '../modules/erp/adapters/registry';
import { parseTintingBase } from '../modules/erp/tinting/parse-base';
import { normalizeBaseTitle } from '../modules/erp/tinting/plan-base-products';
import {
  applyPresentationOptions,
  readPresentationState,
} from '../modules/erp/sync/apply-presentation-option';
import { planPresentationOptions } from '../modules/erp/sync/presentation-option';
import { resolveTitleRules, titleRulesFingerprint } from '../modules/erp/sync/product-title';
import { ERP_CATALOG_PRICES_UPDATED } from '../modules/erp/sync/run-catalog-sync';
import type { ErpConfigSettings } from '../modules/erp/types';

const PAGE = 1_000;
const WRITE_BATCH = 50;

type Target = {
  sku: string;
  variant_id: string;
  product_id: string;
  current: string;
  next: string;
  source_title: string;
  /**
   * Metadata ACTUAL de la variante. `updateProductVariantsWorkflow` REEMPLAZA el
   * objeto entero, así que hay que mandarla completa: sin esto el backfill se
   * llevaría `tinting_base` puesto, que es justo el marcador por el que esta
   * variante entró acá.
   */
  metadata: Record<string, unknown>;
};

export default async function backfillTintingBaseTitles({ container }: ExecArgs) {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const service = container.resolve<ErpModuleService>(ERP_MODULE);
  const apply = process.env.APPLY === 'true';

  const config = await service.getActiveConfig();
  if (!config) {
    logger.error('[tinting] La extensión ERP no está configurada o está deshabilitada.');
    return;
  }
  const adapter = getErpAdapter(config.provider);
  if (!adapter.getCatalogChanges) {
    logger.error(`[tinting] El ERP ${config.provider} no expone catálogo.`);
    return;
  }
  const credentials = service.getDecryptedCredentials(config);
  if (!credentials) {
    logger.error('[tinting] No hay credenciales del ERP guardadas.');
    return;
  }

  const settings = (config.settings ?? {}) as ErpConfigSettings;
  // Las MISMAS reglas que la ruta de alta. Si el operador apagó la
  // normalización, este backfill no tiene nada que hacer.
  const titleRules = (settings.catalog_sync?.title_rules?.enabled ?? true)
    ? resolveTitleRules(settings.catalog_sync?.title_rules)
    : null;
  if (!titleRules) {
    logger.warn(
      '[tinting] La normalización de títulos está APAGADA en la config del ERP: ' +
        'no hay nada que backfillear (el título literal es el comportamiento pedido).'
    );
    return;
  }
  const fingerprint = titleRulesFingerprint(titleRules);

  // ── Catálogo completo del ERP, indexado por código ─────────────────────────
  const rows = await adapter.getCatalogChanges(null, {
    credentials,
    settings: settings as unknown as Record<string, unknown>,
    countryCode: config.country_code,
    logger,
  });
  const erpByCode = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    const code = row.code?.trim();
    if (code) erpByCode.set(code, row);
  }
  logger.info(`[tinting] Catálogo del ERP: ${erpByCode.size} artículos.`);

  // ── Variantes de base que ya existen en Medusa ────────────────────────────
  /**
   * Se filtra por el marcador que escribe la ruta de alta (`tinting_base` en la
   * variante) y no por "el título parece una base": renombrar por parecido
   * tocaría productos que el operador cargó a mano.
   */
  const targets: Target[] = [];
  let scanned = 0;
  let missingInErp = 0;
  let noLongerABase = 0;

  for (let page = 0; page < 500; page += 1) {
    const { data } = (await query.graph({
      entity: 'product_variant',
      fields: ['id', 'sku', 'metadata', 'product_id', 'product.id', 'product.title'],
      pagination: { take: PAGE, skip: page * PAGE, order: { id: 'ASC' } },
    })) as {
      data: Array<{
        id: string;
        sku?: string | null;
        metadata?: Record<string, unknown> | null;
        product_id?: string | null;
        product?: { id: string; title?: string | null } | null;
      }>;
    };

    for (const variant of data) {
      if (variant.metadata?.tinting_base !== true) continue;
      scanned += 1;
      const sku = variant.sku?.trim();
      const productId = variant.product?.id ?? variant.product_id;
      const current = variant.product?.title?.trim() ?? '';
      if (!sku || !productId || !current) continue;

      const row = erpByCode.get(sku);
      if (!row) {
        // El artículo se dio de baja en Zeus: el nombre no se toca a ciegas.
        missingInErp += 1;
        continue;
      }
      // El título GUARDADO en la base tintométrica es la foto del crudo, pero
      // puede no existir (altas viejas) — ahí el crudo es el del ERP de ahora.
      const sourceTitle =
        (typeof variant.metadata?.zeus_source_title === 'string'
          ? variant.metadata.zeus_source_title.trim()
          : '') || (row.title?.trim() ?? '');
      if (!sourceTitle) continue;
      if (parseTintingBase(sourceTitle)?.confidence !== 'high') {
        // Sin detección de base no aplican R25/R26 y el nombre saldría distinto
        // del que escribiría la ruta: se deja para revisión a mano.
        noLongerABase += 1;
        continue;
      }

      const next = normalizeBaseTitle(row, sourceTitle, titleRules);
      if (next === current) continue;
      targets.push({
        sku,
        variant_id: variant.id,
        product_id: productId,
        current,
        next,
        source_title: sourceTitle,
        metadata: variant.metadata ?? {},
      });
    }

    if (data.length < PAGE) break;
  }

  logger.info('================================================');
  logger.info(`[tinting] Bases en Medusa: ${scanned}`);
  logger.info(`[tinting]   a renombrar:   ${targets.length}`);
  logger.info(`[tinting]   ya normalizadas o sin cambio: ${scanned - targets.length - missingInErp - noLongerABase}`);
  logger.info(`[tinting]   sin artículo en el ERP (se saltean): ${missingInErp}`);
  logger.info(`[tinting]   el detector ya no las lee como base (se saltean): ${noLongerABase}`);
  logger.info('================================================');
  for (const t of targets) {
    logger.info(`  ${t.sku}: "${t.current}" → "${t.next}"`);
  }

  if (!apply) {
    // El plan del chip no se puede calcular acá: para una base el target sale del
    // título del producto, y en dry run todavía es el viejo. Se anuncia la
    // escritura sin enumerarla, que es lo único honesto.
    logger.info(
      '[tinting] Al aplicar, el chip de presentación de esas bases se reconcilia ' +
        'en la misma pasada (sólo placeholders y la misma medida escrita distinto).'
    );
    logger.info('[tinting] DRY RUN — no se escribió nada. Correr con APPLY=true para aplicar.');
    return;
  }
  if (!targets.length) return;

  /**
   * El título va por el módulo de producto y NO por `updateProductsWorkflow`, la
   * misma decisión que `apply-product-changes.ts`: el workflow emite
   * `product.updated` por PRODUCTO y en este repo eso dispara un reindex de
   * Typesense por producto (ya hubo un incidente de CPU al 100% con trabajo
   * pesado en loop). `upsertProducts` con `{id, title}` es un update PARCIAL: no
   * toca variantes, categorías ni imágenes. El reindex se hace igual, en UNA
   * pasada, con el evento batcheado del final.
   */
  const productService = container.resolve(Modules.PRODUCT) as unknown as {
    upsertProducts(data: Array<Record<string, unknown>>): Promise<unknown>;
  };

  const written: Target[] = [];
  const failed: Array<{ sku: string; error: string }> = [];

  for (let i = 0; i < targets.length; i += WRITE_BATCH) {
    const batch = targets.slice(i, i + WRITE_BATCH);
    try {
      await productService.upsertProducts(batch.map((t) => ({ id: t.product_id, title: t.next })));
      written.push(...batch);
    } catch (batchError) {
      // De a una para no perder 50 renombres por culpa de uno.
      logger.warn(
        `[tinting] Una tanda de ${batch.length} falló (${(batchError as Error).message}); ` +
          'se reintenta de a una.'
      );
      for (const t of batch) {
        try {
          await productService.upsertProducts([{ id: t.product_id, title: t.next }]);
          written.push(t);
        } catch (error) {
          failed.push({ sku: t.sku, error: (error as Error).message });
        }
      }
    }
    logger.info(`[tinting] Renombradas ${written.length}/${targets.length}.`);
  }

  /**
   * La trazabilidad va después del título y sólo para lo que SE ESCRIBIÓ: si
   * `zeus_source_title` quedara puesto en una base cuyo título falló, la próxima
   * corrida creería que ya está normalizada y no la volvería a intentar.
   */
  for (let i = 0; i < written.length; i += WRITE_BATCH) {
    const batch = written.slice(i, i + WRITE_BATCH);
    try {
      await updateProductVariantsWorkflow(container).run({
        input: {
          product_variants: batch.map((t) => ({
            id: t.variant_id,
            // Completa: el workflow REEMPLAZA la metadata, y acá vive el
            // `tinting_base` por el que esta variante entró al backfill.
            metadata: {
              ...t.metadata,
              zeus_source_title: t.source_title,
              zeus_title_rules_v: fingerprint,
            },
          })),
        },
      });
    } catch (error) {
      // El nombre ya está bien en la tienda; sin la huella sólo se pierde el
      // "con qué reglas se escribió", y la próxima corrida no propone nada
      // porque el título ya coincide.
      logger.warn(
        `[tinting] No se pudo escribir la trazabilidad de ${batch.length} variante(s): ` +
          `${(error as Error).message}`
      );
    }
  }

  /**
   * Etiqueta de presentación de las bases que se acaban de renombrar.
   *
   * Va acá porque el título y el chip los escriben DOS pasadas distintas, y sin
   * esto la contradicción vive hasta la siguiente: este script reescribe el
   * título, pero el chip lo reconcilia el catalog sync y sólo sobre los SKU que
   * el ERP trajo en esa corrida. A las bases Zeus las marca
   * `publica_en_ecommerce: "2"` y quedan fuera del delta, así que su chip espera
   * al BARRIDO COMPLETO, una vez por día a `full_sweep_hour` (default 4).
   *
   * Eso es exactamente lo que pasó con DESDEELSUR-27: la corrida que llevó las
   * bases de 8,7 L a `x10 lt` dejó el chip en `9 lt` durante once horas, y el
   * reindex de abajo publicó esa contradicción en la card del PLP —que pinta el
   * valor de la option, no el título—. El screenshot del ticket es de 19 minutos
   * después.
   *
   * La decisión la toma `planPresentationOptions`, la MISMA función que usan el
   * catalog sync y el PATCH de `tinting/bases/sync-products`: sólo pisa un
   * placeholder o la misma medida escrita distinto, y nunca una etiqueta que
   * alguien escribió a mano. Y va DESPUÉS del renombre a propósito: para una base
   * no hay `zeus_presentacion` en la metadata, así que `readPresentationState`
   * deriva el target del título del producto — tiene que leer el nuevo.
   */
  const presentationTouched = new Set<string>();
  if (written.length) {
    try {
      const plan = planPresentationOptions(
        await readPresentationState(
          container,
          written.map((t) => t.sku)
        )
      );
      const applied = await applyPresentationOptions(container, plan);
      for (const id of applied.touchedProductIds) presentationTouched.add(id);
      for (const error of applied.errors) logger.error(`[tinting] ${error}`);
      logger.info(
        `[tinting] Chip de presentación: ${applied.renamed} renombrado(s), ` +
          `${applied.titles_updated} título(s) de variante, ` +
          `${plan.unchanged} ya estaba(n) bien.`
      );
    } catch (error) {
      // El título ya está bien; el chip lo arrastra el barrido completo de las
      // 04:00 como venía pasando hasta ahora.
      logger.warn(
        `[tinting] No se pudo reconciliar el chip de presentación ` +
          `(${(error as Error).message}); queda para el barrido completo.`
      );
    }
  }

  /**
   * UN evento con todos los productos juntos, el mismo que emite el catalog
   * sync: lo atiende `subscribers/erp-catalog-typesense-sync.ts` y encola un
   * reindex batcheado. Sin esto los nombres quedan bien en la base y viejos en
   * el buscador hasta la pasada del reconcile.
   *
   * Los productos del chip se suman a los del título: `applyPresentationOptions`
   * escribe por el módulo de producto, que no emite `product.updated`, así que si
   * alguno no estaba en `written` su card se quedaría con el valor viejo en el
   * índice.
   */
  if (written.length) {
    try {
      const eventBus = container.resolve(Modules.EVENT_BUS) as {
        emit(data: { name: string; data: unknown }): Promise<unknown>;
      };
      await eventBus.emit({
        name: ERP_CATALOG_PRICES_UPDATED,
        data: {
          product_ids: [
            ...new Set([...written.map((t) => t.product_id), ...presentationTouched]),
          ],
          sync_log_id: 'backfill-tinting-base-titles',
        },
      });
    } catch (error) {
      logger.warn(
        `[tinting] No se pudo encolar el reindex (${(error as Error).message}); ` +
          'los nombres están bien en la base y el reconcile periódico los arrastra.'
      );
    }
  }

  logger.info(`[tinting] Listo: ${written.length} bases renombradas, ${failed.length} fallidas.`);
  for (const f of failed) logger.error(`  ${f.sku}: ${f.error}`);
}
