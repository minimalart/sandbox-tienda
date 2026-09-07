import { ModuleProvider, Modules } from '@medusajs/framework/utils';
import KapsoWhatsappProviderService from './service';

export default ModuleProvider(Modules.NOTIFICATION, {
  services: [KapsoWhatsappProviderService],
});
