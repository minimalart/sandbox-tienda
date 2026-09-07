import { MedusaService } from '@medusajs/framework/utils';
import { SpaceConfigurator } from './models/space-configurator';
import { SpaceDesign } from './models/space-design';
export default class SpaceDesignerModuleService extends MedusaService({
  SpaceConfigurator,
  SpaceDesign,
}) {}
