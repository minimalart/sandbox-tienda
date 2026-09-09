import { MedusaService } from '@medusajs/framework/utils';
import { SpaceConfigurator } from './models/space-configurator';
import { SpaceDesign } from './models/space-design';
import { SpaceQuote } from './models/space-quote';
export default class SpaceDesignerModuleService extends MedusaService({
  SpaceConfigurator,
  SpaceDesign,
  SpaceQuote,
}) {}
