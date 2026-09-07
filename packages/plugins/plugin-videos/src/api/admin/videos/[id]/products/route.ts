import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { siteFromRequest } from '../../../../../lib/multistore/request';
import { assertIdInSite } from '../../../../../lib/multistore/scope';
import { VIMEO_VIDEO_SITE_SCOPE } from '../../../../../modules/vimeo-video/site-scope';
import { VIMEO_VIDEO_MODULE } from '../../../../../modules/vimeo-video';
import VimeoVideoModuleService from '../../../../../modules/vimeo-video/service';
import { AdminLinkProductsType, AdminUnlinkProductsType } from '../../validators';

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  // El id del padre. Guardarlo alcanza: esta ruta no es alcanzable por otra vía.
  await assertIdInSite(req.scope, await siteFromRequest(req), VIMEO_VIDEO_SITE_SCOPE, req.params.id as string);

  const vimeoVideoModuleService = req.scope.resolve<VimeoVideoModuleService>(VIMEO_VIDEO_MODULE);
  const { id } = req.params;

  const links = await vimeoVideoModuleService.listProductVideoLinks({
    vimeo_video_id: id,
  });

  res.json({ links });
};

export const POST = async (req: MedusaRequest<AdminLinkProductsType>, res: MedusaResponse) => {
  // El id del padre. Guardarlo alcanza: esta ruta no es alcanzable por otra vía.
  await assertIdInSite(req.scope, await siteFromRequest(req), VIMEO_VIDEO_SITE_SCOPE, req.params.id as string);

  const vimeoVideoModuleService = req.scope.resolve<VimeoVideoModuleService>(VIMEO_VIDEO_MODULE);
  const { id } = req.params;
  const { product_ids } = req.validatedBody;

  const links = await Promise.all(
    product_ids.map((product_id: string) =>
      vimeoVideoModuleService.createProductVideoLinks({
        product_id,
        vimeo_video_id: id,
      })
    )
  );

  res.status(201).json({ links });
};

export const DELETE = async (
  req: MedusaRequest<AdminUnlinkProductsType>,
  res: MedusaResponse
) => {
  // El id del padre. Guardarlo alcanza: esta ruta no es alcanzable por otra vía.
  await assertIdInSite(req.scope, await siteFromRequest(req), VIMEO_VIDEO_SITE_SCOPE, req.params.id as string);

  const vimeoVideoModuleService = req.scope.resolve<VimeoVideoModuleService>(VIMEO_VIDEO_MODULE);
  const { id } = req.params;
  const { product_ids } = req.validatedBody;

  const existingLinks = await vimeoVideoModuleService.listProductVideoLinks({
    vimeo_video_id: id,
    product_id: product_ids,
  });

  await Promise.all(
    existingLinks.map((link: any) =>
      vimeoVideoModuleService.deleteProductVideoLinks(link.id as string)
    )
  );

  res.status(204).send();
};
