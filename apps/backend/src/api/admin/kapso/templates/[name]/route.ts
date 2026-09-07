import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { MedusaError } from '@medusajs/framework/utils';
import {
  kapsoErrorMessage,
  kapsoFromEnv,
} from '../../../../../modules/kapso-whatsapp/client';
import type { UpdateKapsoTemplateInput } from '../validators';

/**
 * PUT /admin/kapso/templates/:name — edita un template EXISTENTE en Meta. Meta lo
 * identifica por su `id` (viene en el body); el `:name` de la URL es solo
 * referencia. Solo se editan `category`/`components`. Editar una plantilla
 * aprobada la devuelve a revisión (PENDING).
 */
export async function PUT(
  req: MedusaRequest<UpdateKapsoTemplateInput>,
  res: MedusaResponse,
): Promise<void> {
  const { client } = kapsoFromEnv();
  const { id, category, components } = req.validatedBody;
  try {
    const result = await client.updateTemplate(id, { category, components });
    res.json({ updated: true, name: req.params.name, result });
  } catch (error) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, kapsoErrorMessage(error));
  }
}

/**
 * DELETE /admin/kapso/templates/:name — elimina el template (todas sus
 * traducciones) por nombre.
 */
export async function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const { client, wabaId } = kapsoFromEnv();
  const name = req.params.name;
  if (!name) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, 'Falta el nombre del template.');
  }
  try {
    await client.deleteTemplate(wabaId, name);
    res.json({ deleted: true, name });
  } catch (error) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, kapsoErrorMessage(error));
  }
}
