import type { Logger, MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { SEO_GEO_MODULE } from '../modules/seo-geo';
import type SeoGeoModuleService from '../modules/seo-geo/service';
import { getSeoGeoConfig } from '../modules/seo-geo/config';
import { resolveSiteStorefrontUrl } from '../modules/seo-geo/lib/storefront-url';
import { listSites } from '../lib/multistore/resolve-site';
import type { SiteRef } from '../lib/multistore/types';

/**
 * Job de automatización (PRD §19): si la automatización está habilitada, encola
 * una auditoría cuando pasó el período configurado (semanal/mensual) desde la
 * última. Corre 1 vez por hora; el job `seo-audit-run` la ejecuta después.
 *
 * ── Por qué esto recorre tiendas ────────────────────────────────────────────────
 *
 * `admin/seo-geo/config` está declarada `scoped` y la pantalla deja que CADA tienda
 * elija su frecuencia. El job leía `getSeoGeoConfig(container)` sin tienda, o sea la
 * fila global, y las tres partes estaban rotas de forma coordinada:
 *
 *   1. leía la config de la INSTANCIA (la frecuencia de la tienda no se miraba nunca),
 *   2. medía el período con `listSeoAudits({ trigger: 'scheduled' })` GLOBAL, así que
 *      la auditoría de una tienda bloqueaba la de todas las demás,
 *   3. creaba con `sales_channel_id` implícito en `null`, que con
 *      `SEO_AUDIT_SITE_SCOPE.empty = 'all'` significa "visible desde TODAS".
 *
 * Arreglar una sola no sirve: con (1) arreglada y (2) rota, la tienda con la
 * frecuencia más corta gana y las otras nunca llegan; con (1) y (2) arregladas y (3)
 * rota, las N auditorías nacen globales y la (2) de la corrida siguiente vuelve a
 * medir un único período compartido. Van juntas o no van.
 *
 * ── Qué pasa con la capa de instancia (`sales_channel_id` null) ─────────────────
 *
 * NO se encola más una auditoría sin canal cuando el registro tiene tiendas.
 *
 * El descriptor lo decide: `SEO_AUDIT_SITE_SCOPE.empty = 'all'` — una auditoría sin
 * canal se ve desde TODAS las tiendas. Encolar una "de la instancia" además de las N
 * por tienda le pondría a cada operador, arriba de su propia lista y de su dashboard,
 * una corrida ajena presentada como propia. Y no habría nada que la distinga: es una
 * fila más de `seo_audit`, con score y hallazgos, del crawl de otro storefront.
 *
 * Tampoco queda nada que auditar en esa capa: con el registro poblado, la principal
 * ES una tienda (`is_main`) y le toca la raíz del storefront. La auditoría "de la
 * instancia" sería un crawl duplicado de esa misma URL, etiquetado "de todos".
 *
 * Si `empty` fuera `'unassigned'` la respuesta sería la opuesta —una fila sin canal
 * no la ve nadie, así que sería basura invisible en vez de ruido compartido— pero
 * seguiría sin haber motivo para crearla.
 *
 * El registro VACÍO (proyecto mono-tienda, o `demo_store` todavía sin crear) sigue
 * encolando la global, byte por byte como antes: ahí `null` es la única capa que hay.
 */
export const config = {
  name: 'seo-audit-schedule',
  schedule: process.env.SEO_GEO_SCHEDULE_CHECK || '0 * * * *',
};

const PERIOD_MS: Record<string, number> = {
  weekly: 7 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
};

/**
 * Encola (o no) la auditoría de UNA capa: una tienda, o la instancia con `site: null`.
 *
 * Devuelve si encoló, sólo para el log agregado del final.
 */
async function scheduleForSite(
  container: MedusaContainer,
  service: SeoGeoModuleService,
  logger: Logger,
  site: SiteRef | null,
): Promise<boolean> {
  const label = site ? `tienda "${site.slug}"` : 'instancia';

  // (1) La config DE ESTA capa. `readSetting` ya cae a la fila global cuando la
  // tienda no guardó la suya, así que pasar el id nunca deja a nadie sin config —
  // que es lo que haría un `fail-closed` acá, y apagaría la automatización de toda
  // instalación que todavía tenga su config sólo en la fila global.
  const cfg = await getSeoGeoConfig(container, site?.id ?? null);
  if (!cfg.automation.enabled || cfg.automation.frequency === 'off') return false;
  const period = PERIOD_MS[cfg.automation.frequency];
  if (!period) return false;

  const channels = site?.channel_ids ?? [];

  // Una tienda sin ningún canal aprovisionado no puede POSEER una auditoría: crearla
  // con `sales_channel_id: null` sería exactamente el bug que este job cierra, sólo
  // que con otro origen. Se saltea con warn en vez de nacer global.
  if (site && channels.length === 0) {
    logger.warn(
      `[seo-geo] ${label} no tiene sales channel aprovisionado: no se le puede encolar ` +
        'una auditoría propia (nacería sin canal, o sea visible desde todas).',
    );
    return false;
  }

  // (2) El período contra la última auditoría DE ESTA capa.
  //
  // El `null` va INCLUIDO en el filtro de la tienda a propósito: con `empty: 'all'`,
  // una auditoría sin canal —las que dejó este mismo job antes del arreglo, o una
  // corrida anterior a que hubiera tiendas— se ve desde esta tienda, así que también
  // cuenta como "la última que el operador ve". Excluirla haría que el día del deploy
  // las N tiendas encolen todas a la vez ignorando la corrida de ayer.
  const filters: Record<string, unknown> = { trigger: 'scheduled' };
  if (channels.length) filters.sales_channel_id = [...channels, null];

  const last = await service.listSeoAudits(filters, { take: 1, order: { created_at: 'DESC' } });
  const lastAt = last[0]?.created_at ? new Date(last[0].created_at).getTime() : 0;
  if (Date.now() - lastAt < period) return false;

  // (3) Y se crea CON el canal de esta tienda, y con SU URL: sin `base_url` el
  // crawler cae a `resolveStorefrontUrl()`, que es la raíz de la instancia, y las N
  // auditorías recorrerían el mismo storefront guardando el resultado bajo canales
  // distintos.
  await service.createSeoAudits({
    trigger: 'scheduled',
    status: 'queued',
    sales_channel_id: channels[0] ?? null,
    base_url: site ? resolveSiteStorefrontUrl(site) : null,
    config: cfg,
  });
  logger.info(`[seo-geo] auditoría programada encolada para ${label} (frecuencia: ${cfg.automation.frequency})`);
  return true;
}

export default async function seoAuditScheduleJob(container: MedusaContainer): Promise<void> {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const service = container.resolve<SeoGeoModuleService>(SEO_GEO_MODULE);

  // `listSites` devuelve `[]` tanto sin módulo como sin tabla como con la tabla
  // vacía: los tres son "acá no hay multitienda" y caen a la capa de instancia.
  const sites = await listSites(container);
  const layers: Array<SiteRef | null> = sites.length ? sites : [null];

  for (const site of layers) {
    // Una tienda que falla no puede dejar sin auditoría a las demás: el crawl de la
    // tienda B no tiene nada que ver con el de la A.
    try {
      await scheduleForSite(container, service, logger, site);
    } catch (error) {
      logger.warn(
        `[seo-geo] no se pudo programar la auditoría de ${site ? `"${site.slug}"` : 'la instancia'}: ` +
          `${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
