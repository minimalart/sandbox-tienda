import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { Modules } from '@medusajs/framework/utils';
import type { IFileModuleService } from '@medusajs/framework/types';
import { resolveDriverFromAuth } from '../resolve-driver';
import type { StoreDriverUploadType } from '../validators';

// Formatos aceptados para evidencia de entrega (foto del paquete / firma).
const ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024; // 5MB

/** Tamaño real (en bytes) que ocupa un string base64 ya decodificado. */
function base64Bytes(content: string): number {
  const sanitized = content.includes(',') ? content.split(',')[1] ?? '' : content;
  const padding = sanitized.endsWith('==') ? 2 : sanitized.endsWith('=') ? 1 : 0;
  return Math.floor((sanitized.length * 3) / 4) - padding;
}

/**
 * POST /store/delivery/driver/uploads — sube un archivo de evidencia (foto o
 * firma) del repartidor autenticado y devuelve la URL pública.
 *
 * DECISIÓN: el binario se sube acá (endpoint dedicado, base64 igual que
 * /store/customers/me/avatar) y la action 'delivered' recibe solo la `url`
 * resultante. Así evitamos multipart en el flujo de la PWA y desacoplamos el
 * upload de la captura del POD (el repartidor puede subir foto + firma en dos
 * llamadas y mandar ambas URLs en la action).
 *
 * Reusa Modules.FILE (mismo provider configurado — local / S3). No inventa
 * storage. Marca el archivo `public` para que la URL sea accesible desde el
 * ops board sin firmar (mismo criterio que el avatar).
 */
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  // Ownership: solo un repartidor activo puede subir evidencia.
  await resolveDriverFromAuth(req);

  const body = req.validatedBody as StoreDriverUploadType;

  const mimeType = body.mimeType || 'image/png';
  if (!ACCEPTED_MIME_TYPES.includes(mimeType)) {
    res
      .status(400)
      .json({ message: 'Formato no permitido. Subí una imagen JPG, PNG o WebP.' });
    return;
  }
  if (base64Bytes(body.content) > MAX_BYTES) {
    res.status(400).json({ message: 'El archivo supera el peso máximo de 5MB.' });
    return;
  }

  try {
    const fileModule = req.scope.resolve<IFileModuleService>(Modules.FILE);

    const [file] = await fileModule.createFiles([
      {
        filename: body.filename,
        mimeType,
        content: body.content,
        access: 'public',
      },
    ]);

    if (!file?.url) {
      res.status(500).json({ message: 'No se pudo guardar el archivo.' });
      return;
    }

    res.status(201).json({ url: file.url, id: file.id });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'No se pudo subir el archivo';
    res.status(400).json({ message });
  }
}
