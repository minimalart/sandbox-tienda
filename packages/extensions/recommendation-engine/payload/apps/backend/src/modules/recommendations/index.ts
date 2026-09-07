import { Module } from '@medusajs/framework/utils';
import RecommendationEngineModuleService from './service';

/**
 * Key del módulo. Es `recommendation_engine` y NO `recommendations` a propósito:
 * una key genérica corre el riesgo de colisionar con la de un plugin oficial, y
 * esa colisión rompe `medusa build` fallando SÓLO en deploy (fue exactamente lo
 * que pasó con `loyalty` vs `@medusajs/loyalty-plugin`). La carpeta se llama
 * `recommendations`, que es lo que usa `optionalModule` en medusa-config.ts.
 */
export const RECOMMENDATION_ENGINE_MODULE = 'recommendation_engine';

export default Module(RECOMMENDATION_ENGINE_MODULE, {
  service: RecommendationEngineModuleService,
});
