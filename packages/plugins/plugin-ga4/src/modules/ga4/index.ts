import { Module } from '@medusajs/framework/utils';
import Ga4ModuleService from './service';

export const GA4_MODULE = 'ga4';

/**
 * El `Module(...)` con `service: Ga4ModuleService` genera un tipo que arrastra
 * la clase entera. `Ga4ModuleService` extiende `MedusaService({ Ga4EventMapping,
 * Ga4BuiltinSetting, Ga4Settings })`, y con TRES modelos la inferencia de
 * métodos generados desborda el límite de instanciación al emitir el `.d.ts`
 * (TS2589). Casteamos el default export a `unknown` para no arrastrar ese tipo
 * a través del barrel; en runtime sigue siendo el mismo objeto que el host
 * pasa a `Modules`.
 */
const definition = Module(GA4_MODULE, {
  service: Ga4ModuleService,
});

export default definition as unknown as { service: unknown };
