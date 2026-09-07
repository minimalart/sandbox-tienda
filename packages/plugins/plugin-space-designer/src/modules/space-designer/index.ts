import { Module } from '@medusajs/framework/utils';
import SpaceDesignerModuleService from './service';
export const SPACE_DESIGNER_MODULE = 'space_designer';
export default Module(SPACE_DESIGNER_MODULE, { service: SpaceDesignerModuleService });
