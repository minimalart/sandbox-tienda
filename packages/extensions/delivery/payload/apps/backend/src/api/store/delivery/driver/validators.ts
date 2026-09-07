import { z } from 'zod';

// Acciones que el repartidor puede ejecutar sobre una ejecución asignada.
export const DRIVER_ACTION_VALUES = [
  'pickup',
  'in_transit',
  'delivered',
  'failed_attempt',
] as const;

const LocationSchema = z.object({
  lat: z.number(),
  lng: z.number(),
});

// Tipos de evidencia que el driver puede adjuntar a 'delivered'.
// 'pin' NO se captura por esta vía (es del flujo CDE / store_pickup).
export const DRIVER_PROOF_TYPES = ['photo', 'signature', 'geo', 'note'] as const;

// Evidencia de entrega (M5) adjunta a la action 'delivered'. file_url /
// signature_url ya vienen subidos vía /store/delivery/driver/uploads.
const DriverProofSchema = z.object({
  type: z.enum(DRIVER_PROOF_TYPES),
  file_url: z.string().url().optional(),
  signature_url: z.string().url().optional(),
  note: z.string().max(2000).optional(),
});
export type StoreDriverProofType = z.infer<typeof DriverProofSchema>;

export const StoreDriverActionSchema = z
  .object({
    action: z.enum(DRIVER_ACTION_VALUES),
    location: LocationSchema.optional(),
    note: z.string().max(2000).optional(),
    proof: DriverProofSchema.optional(),
  })
  // 'delivered' en flota propia EXIGE evidencia. Validamos acá para devolver un
  // 400 claro antes de llegar al gating del service. El gating del service es
  // la red de seguridad para cualquier otra vía (admin/script).
  .refine(
    (data) => data.action !== 'delivered' || data.proof !== undefined,
    {
      message:
        "La acción 'delivered' requiere una evidencia de entrega (proof: foto, firma o geo).",
      path: ['proof'],
    },
  )
  // Si el proof es 'photo' debe traer file_url; si es 'signature', signature_url.
  .refine(
    (data) =>
      !data.proof ||
      data.proof.type !== 'photo' ||
      Boolean(data.proof.file_url),
    {
      message: "Un proof type 'photo' requiere file_url.",
      path: ['proof', 'file_url'],
    },
  )
  .refine(
    (data) =>
      !data.proof ||
      data.proof.type !== 'signature' ||
      Boolean(data.proof.signature_url),
    {
      message: "Un proof type 'signature' requiere signature_url.",
      path: ['proof', 'signature_url'],
    },
  );
export type StoreDriverActionType = z.infer<typeof StoreDriverActionSchema>;

// Upload de evidencia del driver (base64, igual que el avatar). El binario se
// sube vía Modules.FILE en /store/delivery/driver/uploads.
export const StoreDriverUploadSchema = z.object({
  filename: z.string().min(1),
  mimeType: z.string().optional(),
  content: z.string().min(1),
});
export type StoreDriverUploadType = z.infer<typeof StoreDriverUploadSchema>;
