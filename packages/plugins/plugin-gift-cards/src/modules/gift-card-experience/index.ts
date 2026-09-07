import { Module } from '@medusajs/framework/utils';
import GiftCardExperienceModuleService from './service';

export const GIFT_CARD_EXPERIENCE_MODULE = 'gift_card_experience';

const moduleDefinition: ReturnType<typeof Module> = Module(GIFT_CARD_EXPERIENCE_MODULE, {
  service: GiftCardExperienceModuleService,
});

export default moduleDefinition;
