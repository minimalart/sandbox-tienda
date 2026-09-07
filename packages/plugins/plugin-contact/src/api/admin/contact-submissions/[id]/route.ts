import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { z } from 'zod';
import { CONTACT_MODULE } from '../../../../modules/contact';
import type ContactModuleService from '../../../../modules/contact/service';
import { assertIdInSite, siteFromRequest } from '../../../../lib/multistore-shim';
import { CONTACT_SUBMISSION_SITE_SCOPE } from '../../../../modules/contact/site-scope';

const StatusSchema = z.object({ status: z.enum(['new', 'read', 'archived']) });

/**
 * `assertIdInSite` is called BEFORE the mutation on every handler. Filtering the
 * listing but leaving the id-based mutation open would hide the other tenant's
 * row from the inbox but let anyone with the id mark it read or archive it —
 * and the customer's real message would silently disappear from the operator
 * that had to answer it. The guard mirrors the host's behavior on the extension
 * side (`apps/backend/src/api/admin/contact-submissions/[id]/route.ts` in the
 * boilerplate before the plugin split).
 */

/** POST /admin/contact-submissions/:id — cambia el estado (new/read/archived). */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = StatusSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Estado inválido (new | read | archived)' });
  }

  await assertIdInSite(
    req.scope,
    await siteFromRequest(req),
    CONTACT_SUBMISSION_SITE_SCOPE,
    req.params.id as string,
  );

  const service: ContactModuleService = req.scope.resolve(CONTACT_MODULE);
  await service.updateContactSubmissions({
    id: req.params.id as string,
    status: parsed.data.status,
  });
  const contact_submission = await service.retrieveContactSubmission(req.params.id as string);
  return res.json({ contact_submission });
}

/** DELETE /admin/contact-submissions/:id — elimina (soft-delete). */
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  await assertIdInSite(
    req.scope,
    await siteFromRequest(req),
    CONTACT_SUBMISSION_SITE_SCOPE,
    req.params.id as string,
  );

  const service: ContactModuleService = req.scope.resolve(CONTACT_MODULE);
  await service.deleteContactSubmissions(req.params.id as string);
  return res.json({ id: req.params.id, object: 'contact_submission', deleted: true });
}
