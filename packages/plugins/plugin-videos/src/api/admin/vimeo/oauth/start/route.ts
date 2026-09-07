import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { VIMEO_VIDEO_MODULE } from '../../../../../modules/vimeo-video';
import VimeoVideoModuleService from '../../../../../modules/vimeo-video/service';
import { AdminVimeoOAuthStartQueryType } from '../../validators';

export const GET = async (
  req: MedusaRequest<AdminVimeoOAuthStartQueryType>,
  res: MedusaResponse
) => {
  const vimeoService = req.scope.resolve<VimeoVideoModuleService>(VIMEO_VIDEO_MODULE);

  const { redirect_to } = req.validatedQuery || {};

  const state = redirect_to
    ? Buffer.from(JSON.stringify({ redirect_to })).toString('base64url')
    : undefined;

  const authUrl = await vimeoService.getAuthorizationUrl(state);

  res.json({ url: authUrl });
};
