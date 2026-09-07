import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { VIMEO_VIDEO_MODULE } from '../../../../../modules/vimeo-video';
import VimeoVideoModuleService from '../../../../../modules/vimeo-video/service';

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const vimeoVideoModuleService = req.scope.resolve<VimeoVideoModuleService>(VIMEO_VIDEO_MODULE);
  const { id } = req.params;

  if (!id) {
    res.status(400).json({ message: 'Video ID is required' });
    return;
  }

  try {
    const video = await vimeoVideoModuleService.syncVideoFromVimeo(id);
    res.json({ video });
  } catch (error) {
    console.error('[API] Error syncing video:', error);
    res.status(500).json({
      message: 'Failed to sync video from Vimeo',
      error: (error as any).message,
    });
  }
};
