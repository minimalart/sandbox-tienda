import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { siteFromRequest } from '../../../lib/multistore/request';
import { siteDefaults, siteFilter } from '../../../lib/multistore/scope';
import { VIMEO_VIDEO_SITE_SCOPE } from '../../../modules/vimeo-video/site-scope';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { VIMEO_VIDEO_MODULE } from '../../../modules/vimeo-video';
import VimeoVideoModuleService from '../../../modules/vimeo-video/service';
import { AdminCreateVideoType } from './validators';

// Estados no-terminales: el video sigue procesándose en Vimeo. Los videos se
// crean con este estado (transcoding/uploading) y Vimeo termina en background,
// así que al listar re-sincronizamos los que siguen "en progreso".
const IN_PROGRESS_STATUSES = ['uploading', 'transcoding', 'processing', 'transcode_starting'];

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const vimeoVideoModuleService = req.scope.resolve<VimeoVideoModuleService>(VIMEO_VIDEO_MODULE);

  const { offset = 0, limit = 50, order = '-created_at' } = req.query;
  const listOptions = {
    skip: Number(offset),
    take: Number(limit),
    order: { created_at: order === '-created_at' ? 'DESC' : ('ASC' as const) },
  };

  const resolution = await siteFromRequest(req);
  const siteWhere = await siteFilter(req.scope, resolution, VIMEO_VIDEO_SITE_SCOPE);

  let videos = await vimeoVideoModuleService.listVideos(siteWhere, listOptions);

  // Auto-heal del estado: re-sincroniza desde Vimeo los videos en progreso
  // (best-effort, no rompe el listado si Vimeo falla o no está conectado) y
  // vuelve a listar para devolver los estados frescos.
  const stale = (videos as Array<Record<string, any>>).filter((v) =>
    IN_PROGRESS_STATUSES.includes(v.status)
  );
  if (stale.length > 0) {
    await Promise.all(
      stale.map((v) => vimeoVideoModuleService.syncVideoFromVimeo(v.id as string).catch(() => null))
    );
    videos = await vimeoVideoModuleService.listVideos(siteWhere, listOptions);
  }

  res.json({
    videos,
    count: videos.length,
    offset: Number(offset),
    limit: Number(limit),
  });
};

export const POST = async (req: MedusaRequest<AdminCreateVideoType>, res: MedusaResponse) => {
  const vimeoVideoModuleService = req.scope.resolve<VimeoVideoModuleService>(VIMEO_VIDEO_MODULE);

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  // El video nace con los canales de la tienda activa. Sin esto se crea global y
  // aparece en todas — y el creador no vuelve a encontrarlo donde lo subió.
  const video = await vimeoVideoModuleService.createVideo({
    ...siteDefaults(await siteFromRequest(req), VIMEO_VIDEO_SITE_SCOPE),
    ...req.validatedBody,
  } as typeof req.validatedBody);

  try {
    await query.graph({
      entity: 'vimeo_video',
      fields: ['*'],
      filters: { id: video.id },
    });
  } catch (error) {
    console.error('[API] Failed to commit:', error);
  }

  res.status(201).json({ video });
};
