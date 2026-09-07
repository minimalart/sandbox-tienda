import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { setCorporateStatusWorkflow } from '../../../../../workflows/set-corporate-status';
import { PostSetStatus } from '../../validators';
import { siteFromRequest } from '../../../../../lib/multistore/request';
import { assertIdInSite } from '../../../../../lib/multistore/scope';
import { CORPORATE_SITE_SCOPE } from '../../../../../modules/corporate/site-scope';

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  // `req.params.id` es la raíz del dominio, como en `corporates/[id]`. Que la
  // mutación la haga un workflow no cambia nada: el eje de tienda se decide en el
  // borde, con el id que entró por la URL, antes de que el workflow lo tome por
  // válido. Y es el verbo que suspende o archiva una cuenta B2B viva.
  await assertIdInSite(req.scope, await siteFromRequest(req), CORPORATE_SITE_SCOPE, req.params.id as string);

  const parsed = PostSetStatus.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Invalid body' });
    return;
  }
  const { result } = await setCorporateStatusWorkflow(req.scope).run({
    input: { corporate_id: req.params.id as string, status: parsed.data.status },
  });
  res.json({ corporate: result });
}
