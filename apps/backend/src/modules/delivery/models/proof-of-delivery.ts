import { model } from '@medusajs/framework/utils';

/**
 * ProofOfDelivery (POD) — evidencia de una entrega (M5).
 *
 * Cada POD pertenece a UNA DeliveryExecution (FK lógica `delivery_execution_id`,
 * mismo módulo). Una ejecución puede tener varios PODs (ej. foto + firma + geo),
 * por eso NO es un link cross-módulo: vive dentro del módulo delivery y se
 * referencia por columna indexada, igual que TrackingEvent.
 *
 * Tipos de evidencia (`type`):
 *  - 'photo'     → foto del paquete entregado (file_url).
 *  - 'signature' → firma del receptor (signature_url).
 *  - 'pin'       → validación por PIN (flujo CDE / store_pickup); pin_validated.
 *  - 'geo'       → captura de geolocalización (captured_lat / captured_lng).
 *  - 'note'      → nota de texto del repartidor.
 *
 * Los archivos (foto/firma) se suben aparte vía Modules.FILE y acá solo se
 * guarda la URL pública resultante — el módulo delivery NO maneja binarios.
 */
export const ProofOfDelivery = model
  .define('proof_of_delivery', {
    id: model.id({ prefix: 'pod' }).primaryKey(),
    // FK lógica a delivery_execution (mismo módulo). Indexada para listar los
    // PODs de una ejecución y para el gating de 'delivered'.
    delivery_execution_id: model.text(),
    // 'photo' | 'signature' | 'pin' | 'geo' | 'note' (ver ProofType en types.ts).
    type: model.text(),
    // URL pública del archivo (foto / manifest), subido vía Modules.FILE.
    file_url: model.text().nullable(),
    // URL pública de la firma capturada (imagen), subida vía Modules.FILE.
    signature_url: model.text().nullable(),
    // Geolocalización de la captura (no confundir con la del TrackingEvent).
    // float (no number): las coordenadas necesitan decimales.
    captured_lat: model.float().nullable(),
    captured_lng: model.float().nullable(),
    // Quién capturó la evidencia: driver_id (flota propia) o user/operador (CDE).
    captured_by: model.text().nullable(),
    // Resultado de la validación del PIN (solo type='pin'); null para los demás.
    pin_validated: model.boolean().nullable(),
    note: model.text().nullable(),
    captured_at: model.dateTime(),
    metadata: model.json().nullable(),
  })
  .indexes([
    { on: ['delivery_execution_id'], where: 'deleted_at IS NULL' },
    { on: ['type'], where: 'deleted_at IS NULL' },
  ]);

export default ProofOfDelivery;
