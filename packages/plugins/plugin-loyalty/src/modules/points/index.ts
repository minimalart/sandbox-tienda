import { Module } from '@medusajs/framework/utils';
import PointsModuleService from './service';

export const POINTS_MODULE = 'points';

const moduleDefinition: ReturnType<typeof Module> = Module(POINTS_MODULE, {
  service: PointsModuleService,
});

export default moduleDefinition;
