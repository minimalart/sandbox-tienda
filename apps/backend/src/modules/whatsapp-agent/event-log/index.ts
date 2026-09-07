import { Module } from '@medusajs/framework/utils';
import WhatsappEventLogService from './service';
import { WHATSAPP_EVENT_LOG_MODULE } from './types';

export { WHATSAPP_EVENT_LOG_MODULE } from './types';
export { WA_EVENT_TYPES, type WaEventType } from './types';

export default Module(WHATSAPP_EVENT_LOG_MODULE, {
  service: WhatsappEventLogService,
});
