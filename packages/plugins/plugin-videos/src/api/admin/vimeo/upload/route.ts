import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { VIMEO_VIDEO_MODULE } from '../../../../modules/vimeo-video';
import VimeoVideoModuleService from '../../../../modules/vimeo-video/service';
import { AdminVimeoUploadBodyType } from '../validators';

export const POST = async (req: MedusaRequest<AdminVimeoUploadBodyType>, res: MedusaResponse) => {
  const vimeoService = req.scope.resolve<VimeoVideoModuleService>(VIMEO_VIDEO_MODULE);

  const { title, description, file_size } = req.validatedBody;

  const result = await vimeoService.initiateUpload(title, description, file_size);

  res.json(result);
};
