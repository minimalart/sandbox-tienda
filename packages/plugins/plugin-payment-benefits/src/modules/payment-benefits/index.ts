import { Module } from '@medusajs/framework/utils';
import PaymentBenefitsModuleService from './service';

export { PAYMENT_BENEFITS_MODULE } from './types';

const moduleDefinition: ReturnType<typeof Module> = Module('payment_benefits', {
  service: PaymentBenefitsModuleService,
});

export default moduleDefinition;
