import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { VIMEO_VIDEO_MODULE } from '../../../../modules/vimeo-video';
import VimeoVideoModuleService from '../../../../modules/vimeo-video/service';

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const vimeoService = req.scope.resolve<VimeoVideoModuleService>(VIMEO_VIDEO_MODULE);

  const status = await vimeoService.getConnectionStatus();

  res.json(status);
};
