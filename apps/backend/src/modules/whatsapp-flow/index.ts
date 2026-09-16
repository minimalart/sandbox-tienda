import { Module } from '@medusajs/framework/utils';

import WhatsappFlowModuleService from './service';
import { WHATSAPP_FLOW_MODULE } from './types';

export { WHATSAPP_FLOW_MODULE } from './types';

export default Module(WHATSAPP_FLOW_MODULE, { service: WhatsappFlowModuleService });
