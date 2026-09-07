import { model } from '@medusajs/framework/utils';

/**
 * ErpInvoice — el comprobante que el ERP emitió por una orden.
 *
 * Existe porque el ERP factura de forma ASINCRÓNICA: `notifySale` inserta el
 * pedido y devuelve una referencia (en Zeus, `idtransac`), pero el comprobante
 * todavía no existe. Recuperarlo es un poll (evento `invoice_fetch` del
 * outbox), y esta tabla es donde aterriza el resultado: los datos fiscales para
 * mostrar, y el `file_id` del PDF ya guardado en el File module.
 *
 * El PDF se guarda como archivo PRIVADO. El endpoint del ERP que lo emite
 * acepta el JWT como query param, y ese token lee el catálogo, crea clientes y
 * crea pedidos — así que nunca puede viajar en una URL. La descarga va siempre
 * por un proxy autenticado (mismo criterio ya tomado para las imágenes del
 * catálogo).
 *
 * Un comprobante por orden y por provider: el unique parcial lo garantiza y
 * hace idempotente al poll (si el evento se reprocesa, se actualiza la fila que
 * ya está).
 */
export const ErpInvoice = model
  .define('erp_invoice', {
    id: model.id({ prefix: 'erpinv' }).primaryKey(),
    order_id: model.text(),
    provider: model.text(),
    /** Referencia del pedido en el ERP (Zeus: `idtransac`). */
    external_ref: model.text(),
    /** Sucursal emisora (necesaria para pedir el PDF). */
    sucursal: model.number().nullable(),
    /** Número de comprobante. */
    numero_comp: model.number().nullable(),
    /** Tipo de comprobante (necesario para pedir el PDF). */
    tipo_comp: model.text().nullable(),
    /** Letra del comprobante (A/B/C en AR). */
    letra: model.text().nullable(),
    punto_de_venta: model.number().nullable(),
    /** Fecha de emisión tal cual la informa el ERP (sin reinterpretar zonas). */
    fecha: model.text().nullable(),
    /**
     * Total del comprobante tal cual lo informa el ERP. Es un ESPEJO para
     * mostrar y auditar, nunca se calcula con él (los totales de la orden son
     * los de Medusa), así que no necesita `bigNumber`.
     */
    total: model.number().nullable(),
    /** File module: `null` mientras el PDF no se pudo bajar. */
    file_id: model.text().nullable(),
    file_url: model.text().nullable(),
    /** Respuesta cruda del ERP, para auditar sin volver a preguntar. */
    raw: model.json().nullable(),
  })
  .indexes([
    { on: ['provider', 'order_id'], unique: true, where: 'deleted_at IS NULL' },
    { on: ['order_id'] },
    { on: ['external_ref'] },
  ]);
