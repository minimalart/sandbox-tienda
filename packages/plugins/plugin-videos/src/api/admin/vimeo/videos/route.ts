import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { VIMEO_VIDEO_MODULE } from '../../../../modules/vimeo-video';
import VimeoVideoModuleService from '../../../../modules/vimeo-video/service';
import { AdminVimeoSearchQueryType } from '../validators';

export const GET = async (req: MedusaRequest<AdminVimeoSearchQueryType>, res: MedusaResponse) => {
  const vimeoService = req.scope.resolve<VimeoVideoModuleService>(VIMEO_VIDEO_MODULE);

  const { query, page = 1, per_page = 25 } = req.validatedQuery || {};

  const result = await vimeoService.searchVimeoVideos(
    query as string | undefined,
    page as number,
    per_page as number
  );

  res.json(result);
};
