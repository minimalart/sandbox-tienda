import { Module } from '@medusajs/framework/utils';
import LoyaltyModuleService from './service';

// NOTE: must NOT be 'loyalty' — that key belongs to @medusajs/loyalty-plugin,
// which ships its own `loyalty` module and a loyalty↔gift_card link (used for
// gift-card store credit). Reusing 'loyalty' shadows the plugin's service, so
// its link resolves against this module and `medusa build` fails with
// "Key gift_card_id is not linkable on service loyalty". Keep this distinct.
export const LOYALTY_MODULE = 'loyalty_engine';

const moduleDefinition: ReturnType<typeof Module> = Module(LOYALTY_MODULE, {
  service: LoyaltyModuleService,
});

export default moduleDefinition;
