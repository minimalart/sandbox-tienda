import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { MedusaError } from '@medusajs/framework/utils';
import {
  kapsoErrorMessage,
  kapsoFromEnv,
} from '../../../../modules/kapso-whatsapp/client';
import type { CreateKapsoTemplateInput } from './validators';

/**
 * GET /admin/kapso/templates — lista los templates del WABA con su estado de
 * aprobación. La API key vive solo en el servidor (env), nunca en el browser.
 */
export async function GET(_req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const { client, wabaId } = kapsoFromEnv();
  try {
    const templates = await client.listTemplates(wabaId);
    res.json({ templates, count: templates.length });
  } catch (error) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, kapsoErrorMessage(error));
  }
}

/**
 * POST /admin/kapso/templates — crea un template (lo envía a revisión de Meta).
 * Devuelve lo que responde Kapso/Meta (normalmente con estado PENDING).
 */
export async function POST(
  req: MedusaRequest<CreateKapsoTemplateInput>,
  res: MedusaResponse,
): Promise<void> {
  const { client, wabaId } = kapsoFromEnv();
  try {
    const template = await client.createTemplate(wabaId, req.validatedBody);
    res.status(201).json({ template });
  } catch (error) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, kapsoErrorMessage(error));
  }
}
