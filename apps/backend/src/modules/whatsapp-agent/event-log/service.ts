import { MedusaService } from '@medusajs/framework/utils';
import { WhatsappEvent } from './models';

/**
 * Persistencia de los eventos del embudo de WhatsApp. Sólo el CRUD generado por
 * `MedusaService` (`listWhatsappEvents`, `createWhatsappEvents`, …); quién emite
 * cada evento vive en `lib/whatsapp/events.ts` y la agregación del embudo en la
 * ruta admin.
 */
export default class WhatsappEventLogService extends MedusaService({
  WhatsappEvent,
}) {}
