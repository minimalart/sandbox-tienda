import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { siteFromRequest } from '../../../../lib/multistore/request';
import { assertIdInSite } from '../../../../lib/multistore/scope';
import { VIMEO_VIDEO_SITE_SCOPE } from '../../../../modules/vimeo-video/site-scope';
import { VIMEO_VIDEO_MODULE } from '../../../../modules/vimeo-video';
import VimeoVideoModuleService from '../../../../modules/vimeo-video/service';
import { AdminUpdateVideoType } from '../validators';

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  // Todos los handlers: filtrar el listado y dejar el detalle abierto esconde el
  // video de la otra tienda pero deja borrarlo con sólo saber el id.
  await assertIdInSite(req.scope, await siteFromRequest(req), VIMEO_VIDEO_SITE_SCOPE, req.params.id as string);

  const vimeoVideoModuleService = req.scope.resolve<VimeoVideoModuleService>(VIMEO_VIDEO_MODULE);
  const { id } = req.params;

  if (!id) {
    res.status(400).json({ message: 'Video ID is required' });
    return;
  }

  const video = await vimeoVideoModuleService.retrieveVimeoVideo(id, {
    relations: ['product_links'],
  });

  if (!video) {
    res.status(404).json({ message: 'Video not found' });
    return;
  }

  res.json({ video });
};

export const POST = async (req: MedusaRequest<AdminUpdateVideoType>, res: MedusaResponse) => {
  // Todos los handlers: filtrar el listado y dejar el detalle abierto esconde el
  // video de la otra tienda pero deja borrarlo con sólo saber el id.
  await assertIdInSite(req.scope, await siteFromRequest(req), VIMEO_VIDEO_SITE_SCOPE, req.params.id as string);

  const vimeoVideoModuleService = req.scope.resolve<VimeoVideoModuleService>(VIMEO_VIDEO_MODULE);
  const { id } = req.params;

  if (!id) {
    res.status(400).json({ message: 'Video ID is required' });
    return;
  }

  const video = await vimeoVideoModuleService.updateVideo(id, req.validatedBody);

  res.json({ video });
};

export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  // Todos los handlers: filtrar el listado y dejar el detalle abierto esconde el
  // video de la otra tienda pero deja borrarlo con sólo saber el id.
  await assertIdInSite(req.scope, await siteFromRequest(req), VIMEO_VIDEO_SITE_SCOPE, req.params.id as string);

  const vimeoVideoModuleService = req.scope.resolve<VimeoVideoModuleService>(VIMEO_VIDEO_MODULE);
  const { id } = req.params;

  if (!id) {
    res.status(400).json({ message: 'Video ID is required' });
    return;
  }

  await vimeoVideoModuleService.deleteVideo(id);

  res.status(200).json({ id, deleted: true });
};
