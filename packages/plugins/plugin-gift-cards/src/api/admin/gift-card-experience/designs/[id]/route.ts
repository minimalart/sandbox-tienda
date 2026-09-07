import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import type { z } from 'zod';
import { GIFT_CARD_EXPERIENCE_MODULE } from '../../../../../modules/gift-card-experience';
import type GiftCardExperienceModuleService from '../../../../../modules/gift-card-experience/service';
import { siteFromRequest } from '../../../../../lib/multistore/request';
import { assertIdInSite } from '../../../../../lib/multistore/scope';
import { GIFT_CARD_DESIGN_SITE_SCOPE } from '../../../../../modules/gift-card-experience/site-scope';
import { GiftCardDesignUpdate } from '../../validators';

type Input = z.infer<typeof GiftCardDesignUpdate>;

/**
 * `assertIdInSite` y no `assertRowInSite`: ninguno de los dos handlers lee la fila antes
 * de mutarla —los dos van derecho al `update`—, así que el de fila obligaría a agregar
 * un `retrieve` sólo para tener qué chequear. Al mismo costo, el subselect reusa
 * LITERALMENTE el predicado del listado (`siteFilter` con el mismo descriptor), y por
 * construcción no puede driftear de él.
 *
 * Residual conocido, y se deja a propósito: `GIFT_CARD_DESIGN_SITE_SCOPE` declara
 * `empty: 'all'`, así que el diseño GLOBAL —hoy sólo el `brand-default` que siembra
 * `ensureDefaultDesign`— se ve desde toda tienda y por lo tanto también se puede
 * archivar desde cualquiera, y ese archivado lo saca de TODAS (el reseed chequea
 * existencia por `public_id`, no `active`, así que no lo restaura).
 *
 * La alternativa era endurecer el guard a `'unassigned'` acá nomás. Se descartó: le
 * daría a la mutación un predicado MÁS ESTRICTO que el del listado, y el modo de falla
 * de eso es un operador que ve el diseño en su pantalla y come un 404 al tocarlo, sin
 * ninguna pista de por qué. Proteger una fila sembrada de su propio borrado es un
 * problema del módulo —no tiene nada que ver con qué tienda la mira— y se arregla en el
 * servicio, no torciendo el eje de tienda hasta que tape otra cosa.
 */
export async function POST(req: MedusaRequest<Input>, res: MedusaResponse): Promise<void> {
  // El guard va en TODOS los handlers, no sólo en el GET: filtrar el listado y dejar la
  // mutación abierta esconde el diseño de la otra tienda pero deja reescribirle las
  // imágenes con sólo saber el id.
  await assertIdInSite(
    req.scope,
    await siteFromRequest(req),
    GIFT_CARD_DESIGN_SITE_SCOPE,
    req.params.id as string,
  );

  const service = req.scope.resolve<GiftCardExperienceModuleService>(GIFT_CARD_EXPERIENCE_MODULE);
  const design = await service.updateGiftCardDesigns({ id: req.params.id, ...(req.validatedBody as Input) });
  res.json({ design });
}

/** Designs are archived, never physically deleted. */
export async function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  // Archivar es una mutación como cualquier otra: que no borre la fila no la hace menos
  // destructiva desde la vereda del cliente, porque el diseño deja de ofrecerse.
  await assertIdInSite(
    req.scope,
    await siteFromRequest(req),
    GIFT_CARD_DESIGN_SITE_SCOPE,
    req.params.id as string,
  );

  const service = req.scope.resolve<GiftCardExperienceModuleService>(GIFT_CARD_EXPERIENCE_MODULE);
  const design = await service.updateGiftCardDesigns({ id: req.params.id, active: false });
  res.json({ design });
}
