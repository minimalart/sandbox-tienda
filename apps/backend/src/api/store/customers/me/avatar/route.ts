import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { Modules } from '@medusajs/framework/utils';
import type { ICustomerModuleService, IFileModuleService } from '@medusajs/framework/types';

// Formatos y peso máximo aceptados para el avatar. Se validan también en el
// cliente, pero acá es la frontera real: un curl directo no pasa estos límites.
const ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 2 * 1024 * 1024; // 2MB

/** Tamaño real (en bytes) que ocupa un string base64 ya decodificado. */
function base64Bytes(content: string): number {
  const sanitized = content.includes(',') ? content.split(',')[1] ?? '' : content;
  const padding = sanitized.endsWith('==') ? 2 : sanitized.endsWith('=') ? 1 : 0;
  return Math.floor((sanitized.length * 3) / 4) - padding;
}

/**
 * Borra un archivo del File module sin romper la operación principal. El avatar
 * vive en metadata; si el borrado del binario falla (permisos S3, archivo ya
 * inexistente, etc.) preferimos dejar un huérfano antes que devolverle un error
 * al cliente cuando lo importante —limpiar el metadata— ya se hizo o se hará.
 */
async function deleteFileBestEffort(fileModule: IFileModuleService, fileId: unknown): Promise<void> {
  if (typeof fileId !== 'string' || !fileId) {
    return;
  }
  try {
    await fileModule.deleteFiles(fileId);
  } catch (error) {
    console.error('[avatar] No se pudo borrar el archivo anterior:', fileId, error);
  }
}

/**
 * POST /store/customers/me/avatar — sube (o reemplaza) la foto de perfil del
 * customer autenticado. Recibe el archivo en base64 ({ filename, mimeType,
 * content }) para no manejar multipart; lo guarda con el File module y deja la
 * URL en customer.metadata.avatar_url (y el id en avatar_file_id, para poder
 * limpiar el binario después). Espeja el patrón de companies/me/logo.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const customerId = req.auth_context.actor_id;

  const body = (req.body ?? {}) as { filename?: string; mimeType?: string; content?: string };
  if (!body.content || !body.filename) {
    res.status(400).json({ message: 'Falta el archivo.' });
    return;
  }

  const mimeType = body.mimeType || 'image/png';
  if (!ACCEPTED_MIME_TYPES.includes(mimeType)) {
    res.status(400).json({ message: 'Formato no permitido. Subí una imagen JPG, PNG o WebP.' });
    return;
  }
  if (base64Bytes(body.content) > MAX_BYTES) {
    res.status(400).json({ message: 'La imagen supera el peso máximo de 2MB.' });
    return;
  }

  try {
    const customerModule = req.scope.resolve<ICustomerModuleService>(Modules.CUSTOMER);
    const fileModule = req.scope.resolve<IFileModuleService>(Modules.FILE);

    // Leemos el avatar actual antes de crear el nuevo, para borrarlo al final.
    const customer = await customerModule.retrieveCustomer(customerId);
    const previousFileId = (customer.metadata as Record<string, unknown> | null)?.avatar_file_id;

    const [file] = await fileModule.createFiles([
      {
        filename: body.filename,
        mimeType,
        content: body.content,
        // El File module sube como `private` por default. Con el provider S3
        // (DigitalOcean Spaces) eso deja el objeto inaccesible y el <img> recibe
        // 403 → la foto se ve rota. El avatar es público, así que lo marcamos
        // explícito. En el provider local no cambia nada (no aplica ACL).
        access: 'public',
      },
    ]);
    if (!file?.url) {
      res.status(500).json({ message: 'No se pudo guardar el archivo.' });
      return;
    }

    const metadata = {
      ...((customer.metadata as Record<string, unknown>) ?? {}),
      avatar_url: file.url,
      avatar_file_id: file.id,
    };
    await customerModule.updateCustomers(customerId, { metadata });

    // El metadata ya apunta al archivo nuevo: recién ahora borramos el viejo.
    await deleteFileBestEffort(fileModule, previousFileId);

    res.json({ url: file.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo subir la foto';
    res.status(400).json({ message });
  }
}

/**
 * DELETE /store/customers/me/avatar — quita la foto de perfil del customer
 * autenticado: borra el binario del File module y limpia metadata.avatar_url /
 * avatar_file_id.
 */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const customerId = req.auth_context.actor_id;

  try {
    const customerModule = req.scope.resolve<ICustomerModuleService>(Modules.CUSTOMER);
    const fileModule = req.scope.resolve<IFileModuleService>(Modules.FILE);

    const customer = await customerModule.retrieveCustomer(customerId);
    const fileId = (customer.metadata as Record<string, unknown> | null)?.avatar_file_id;

    // Medusa MERGEA el metadata en vez de reemplazarlo: una clave ausente se
    // preserva, y solo se elimina si se manda con string vacío. Por eso para
    // quitar el avatar mandamos las claves con "" (no basta con omitirlas).
    await customerModule.updateCustomers(customerId, {
      metadata: { avatar_url: '', avatar_file_id: '' },
    });

    await deleteFileBestEffort(fileModule, fileId);

    res.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo quitar la foto';
    res.status(400).json({ message });
  }
}
