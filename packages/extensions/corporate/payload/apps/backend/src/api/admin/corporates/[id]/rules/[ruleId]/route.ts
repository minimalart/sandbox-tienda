import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { Modules } from '@medusajs/framework/utils';
import { CORPORATE_MODULE } from '../../../../../../modules/corporate';
import type CorporateModuleService from '../../../../../../modules/corporate/service';
import { PostUpdateRule } from '../../../validators';
import { siteFromRequest } from '../../../../../../lib/multistore/request';
import { assertIdInSite } from '../../../../../../lib/multistore/scope';
import { CORPORATE_SITE_SCOPE } from '../../../../../../modules/corporate/site-scope';

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  // `req.params.id` es la raíz del dominio, como en `corporates/[id]`: la regla no
  // tiene tienda propia, la hereda de la empresa.
  await assertIdInSite(req.scope, await siteFromRequest(req), CORPORATE_SITE_SCOPE, req.params.id as string);

  const parsed = PostUpdateRule.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Invalid body' });
    return;
  }
  const service = req.scope.resolve<CorporateModuleService>(CORPORATE_MODULE);
  const ruleId = req.params.ruleId as string;
  const corporateId = req.params.id as string;

  /*
    El guard de arriba cubre la TIENDA; esto cubre la PERTENENCIA. Este handler no
    leía la regla —mutaba directo por PK—, así que la lectura se agrega: es el precio
    mínimo de tener el par (empresa, regla) coherente, y una consulta por id es más
    barata que el descuento que una regla ajena aplica en cada carrito.

    El daño no era sólo la mutación: el `corporate.rule.updated` de abajo lleva el
    `:id` del PATH, no el de la regla. Con un `:id` propio y un `:ruleId` ajeno se
    mutaba la regla de otra empresa y encima se invalidaba la caché de la MÍA — la
    empresa realmente afectada nunca se enteraba y seguía sirviendo precios viejos.

    Se compara contra el `:id` de la URL y no contra el subselect de tienda: el cruce
    entre dos empresas de la MISMA tienda también es cruce.

    404 y no 403 por lo mismo que el guard de tienda: el status no tiene que delatar
    que esa regla existe en otro lado.
  */
  const rule = await service.retrieveCorporateRule(ruleId).catch(() => null);
  if (rule?.corporate_id !== corporateId) {
    res.status(404).json({ type: 'not_found', message: 'Regla no encontrada' });
    return;
  }

  const updated = await service.updateCorporateRules({
    id: ruleId,
    ...parsed.data,
  } as any);

  const eventBus = req.scope.resolve(Modules.EVENT_BUS);
  await eventBus.emit({ name: 'corporate.rule.updated', data: { id: corporateId } });

  res.json({ rule: updated });
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  // `req.params.id` es la raíz del dominio, y el guard va en TODOS los verbos.
  await assertIdInSite(req.scope, await siteFromRequest(req), CORPORATE_SITE_SCOPE, req.params.id as string);

  const service = req.scope.resolve<CorporateModuleService>(CORPORATE_MODULE);
  const ruleId = req.params.ruleId as string;
  const corporateId = req.params.id as string;

  // Pertenencia, igual que en el POST, y con la lectura agregada por el mismo motivo:
  // hasta acá el `:id` del path NO se usaba para nada salvo el guard, así que el
  // borrado se resolvía enteramente por la PK de la hija. Un DELETE es la versión sin
  // undo del cruce: la empresa ajena se queda sin su regla de descuento y no hay
  // rastro de quién la sacó.
  const rule = await service.retrieveCorporateRule(ruleId).catch(() => null);
  if (rule?.corporate_id !== corporateId) {
    res.status(404).json({ type: 'not_found', message: 'Regla no encontrada' });
    return;
  }

  await service.deleteCorporateRules([ruleId]);
  res.json({ id: ruleId, deleted: true });
}
