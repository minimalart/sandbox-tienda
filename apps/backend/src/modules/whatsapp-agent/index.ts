import { Module } from '@medusajs/framework/utils';
import WhatsappAgentModuleService from './service';
import { WHATSAPP_AGENT_MODULE } from './types';

export { WHATSAPP_AGENT_MODULE } from './types';

export default Module(WHATSAPP_AGENT_MODULE, {
  service: WhatsappAgentModuleService,
});
