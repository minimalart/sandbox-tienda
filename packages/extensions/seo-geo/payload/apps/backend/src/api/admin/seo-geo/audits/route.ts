import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { siteFromRequest } from '../../../../lib/multistore/request';
import { siteChannelFilter, siteDefaults } from '../../../../lib/multistore/scope';
import { z } from 'zod';
import { SEO_GEO_MODULE } from '../../../../modules/seo-geo';
import type SeoGeoModuleService from '../../../../modules/seo-geo/service';
import { getSeoGeoConfig } from '../../../../modules/seo-geo/config';
import { SEO_AUDIT_SITE_SCOPE } from '../../../../modules/seo-geo/site-scope';
import { resolveSiteStorefrontUrl } from '../../../../modules/seo-geo/lib/storefront-url';

/** Body para encolar una auditoría. Todo opcional: usa la config y URL default. */
export const CreateAuditSchema = z.object({
  sales_channel_id: z.string().optional(),
  base_url: z.string().url().optional(),
  trigger: z.enum(['manual', 'scheduled', 'post_import', 'post_content', 'post_publish']).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

type CreateAuditInput = z.infer<typeof CreateAuditSchema>;

/** GET /admin/seo-geo/audits — lista paginada de auditorías. */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<SeoGeoModuleService>(SEO_GEO_MODULE);
  const limit = req.query.limit ? Number(req.query.limit) : 20;
  const offset = req.query.offset ? Number(req.query.offset) : 0;

  const filters: Record<string, unknown> = {};
  if (typeof req.query.status === 'string' && req.query.status) filters.status = req.query.status;

  // La tienda activa es el DEFAULT; el parámetro explícito sigue ganando. Y filtra por
  // LOS DOS canales de una tienda B2B, no por uno.
  Object.assign(
    filters,
    siteChannelFilter(
      await siteFromRequest(req),
      typeof req.query.sales_channel_id === 'string' ? req.query.sales_channel_id : undefined,
    ),
  );
  if (typeof req.query.sales_channel_id === 'string' && req.query.sales_channel_id) {
    filters.sales_channel_id = req.query.sales_channel_id;
  }

  const [audits, count] = await service.listAndCountSeoAudits(filters, {
    skip: offset,
    take: limit,
    order: { created_at: 'DESC' },
  });

  res.status(200).json({ audits, count, offset, limit });
}

/**
 * POST /admin/seo-geo/audits — encola una auditoría (queued). El job
 * `seo-audit-run` la ejecuta en segundo plano. No corre el crawl en el request.
 */
export async function POST(req: MedusaRequest<CreateAuditInput>, res: MedusaResponse): Promise<void> {
  const input = req.validatedBody as CreateAuditInput;
  const service = req.scope.resolve<SeoGeoModuleService>(SEO_GEO_MODULE);
  const actorId = (req as unknown as { auth_context?: { actor_id?: string } }).auth_context?.actor_id ?? null;

  const resolution = await siteFromRequest(req);
  const site = resolution.status === 'site' ? resolution.site : null;

  // Congela la config efectiva (merge con el patch opcional) al momento de encolar.
  // Con la tienda: la pantalla de config es `scoped`, así que la auditoría manual de
  // la tienda B tiene que congelar el presupuesto de crawl y los umbrales de B — leer
  // la fila global aplicaba los de la instancia y el score salía medido con otra vara.
  const base = await getSeoGeoConfig(req.scope, site?.id ?? null);
  const config = input.config ? { ...base, ...input.config } : base;

  const audit = await service.createSeoAudits({
    // El GET hermano ya filtraba y el POST creaba SIN canal: con
    // `SEO_AUDIT_SITE_SCOPE.empty = 'all'`, la auditoría que el operador de B lanzaba
    // aparecía en la lista de todas las tiendas. El param explícito del body sigue
    // ganando —quien lo manda sabe qué canal pide—, `siteDefaults` sólo cubre el caso
    // en que no viene.
    ...siteDefaults(resolution, SEO_AUDIT_SITE_SCOPE),
    ...(input.sales_channel_id ? { sales_channel_id: input.sales_channel_id } : {}),
    // Misma razón que en `seo-audit-schedule`: sin `base_url`, `runAudit` cae a
    // `resolveStorefrontUrl()` —la raíz de la instancia— y la auditoría de la tienda
    // B terminaría con las páginas de la principal adentro.
    base_url: input.base_url ?? (site ? resolveSiteStorefrontUrl(site) : null),
    trigger: input.trigger ?? 'manual',
    status: 'queued',
    created_by: actorId,
    config,
  });

  res.status(201).json({ audit });
}
