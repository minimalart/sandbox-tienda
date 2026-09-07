import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { Modules } from '@medusajs/framework/utils';
import { COMPANY_MODULE } from '../../../../../modules/company';
import CompanyModuleService, { assertRole } from '../../../../../modules/company/service';
import { COMPANY_MANAGER_ROLES } from '../../../../../modules/company/types';

/**
 * POST /store/companies/me/logo — sube el logo de la empresa (owner/admin).
 * Recibe el archivo en base64 ({ filename, mimeType, content }) para no manejar
 * multipart; lo guarda con el File module y deja la URL en company.metadata.logo.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const customerId = req.auth_context.actor_id;
  const service = req.scope.resolve<CompanyModuleService>(COMPANY_MODULE);
  const membership = await service.getMembershipByCustomer(customerId);
  if (!membership) {
    res.status(404).json({ message: 'No pertenecés a ninguna empresa.' });
    return;
  }
  assertRole(membership.role, COMPANY_MANAGER_ROLES);

  const body = (req.body ?? {}) as { filename?: string; mimeType?: string; content?: string };
  if (!body.content || !body.filename) {
    res.status(400).json({ message: 'Falta el archivo.' });
    return;
  }

  try {
    const fileModule = req.scope.resolve(Modules.FILE);
    const [file] = await fileModule.createFiles([
      {
        filename: body.filename,
        mimeType: body.mimeType || 'image/png',
        content: body.content,
        // El File module sube como `private` por default. Con el provider S3
        // (DigitalOcean Spaces) eso deja el objeto inaccesible y el <img> recibe
        // 403 → el logo se ve roto. El logo es público, así que lo marcamos
        // explícito. En el provider local no cambia nada (no aplica ACL).
        access: 'public',
      },
    ]);
    if (!file?.url) {
      res.status(500).json({ message: 'No se pudo guardar el archivo.' });
      return;
    }

    const company = await service.retrieveCompany(membership.company_id);
    const metadata = { ...((company.metadata as Record<string, unknown>) ?? {}), logo: file.url };
    await service.updateCompanies({ id: membership.company_id, metadata } as any);

    res.json({ url: file.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo subir el logo';
    res.status(400).json({ message });
  }
}
