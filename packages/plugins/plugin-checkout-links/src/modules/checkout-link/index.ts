import { Module } from '@medusajs/framework/utils';
import CheckoutLinkModuleService from './service';

export const CHECKOUT_LINK_MODULE = 'checkout_link';

export default Module(CHECKOUT_LINK_MODULE, {
  service: CheckoutLinkModuleService,
});
