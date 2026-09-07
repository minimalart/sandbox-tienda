import { Module } from '@medusajs/framework/utils';
import ContactModuleService from './service';

export const CONTACT_MODULE = 'contact';

export default Module(CONTACT_MODULE, {
  service: ContactModuleService,
});
