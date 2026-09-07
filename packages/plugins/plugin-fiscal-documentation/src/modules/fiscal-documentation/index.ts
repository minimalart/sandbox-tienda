import { Module } from '@medusajs/framework/utils';
import FiscalDocumentationModuleService from './service';
import { FISCAL_DOCUMENTATION_MODULE } from './types';

export { FISCAL_DOCUMENTATION_MODULE } from './types';

const moduleDefinition: ReturnType<typeof Module> = Module(FISCAL_DOCUMENTATION_MODULE, {
  service: FiscalDocumentationModuleService,
});

export default moduleDefinition;
