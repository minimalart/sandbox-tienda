import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { siteFromRequest } from '../../../../../lib/multistore/request';
import { assertIdInSite } from '../../../../../lib/multistore/scope';
import { BRAND_SITE_SCOPE } from '../../../../../modules/brand/site-scope';
import { z } from 'zod';
import { createBrandImagesWorkflow } from '../../../../../workflows/create-brand-images';

export const CreateBrandImagesSchema = z.object({
  images: z
    .array(
      z.object({
        type: z.enum(['thumbnail', 'image']),
        url: z.string(),
        file_id: z.string(),
      })
    )
    .min(1, 'At least one image is required'),
});

type CreateBrandImagesInput = z.infer<typeof CreateBrandImagesSchema>;

export async function POST(
  req: MedusaRequest<CreateBrandImagesInput>,
  res: MedusaResponse
): Promise<void> {
  // El id del padre. Guardarlo alcanza: esta ruta no es alcanzable por otra vía.
  await assertIdInSite(req.scope, await siteFromRequest(req), BRAND_SITE_SCOPE, req.params.brand_id as string);

  const brand_id = req.params.brand_id as string;
  const { images } = req.validatedBody as CreateBrandImagesInput;

  const brand_images = images.map((image) => ({
    ...image,
    brand_id,
  }));

  const { result } = await createBrandImagesWorkflow(req.scope).run({
    input: {
      brand_images,
    },
  });

  res.status(200).json({ brand_images: result });
}

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  // El id del padre. Guardarlo alcanza: esta ruta no es alcanzable por otra vía.
  await assertIdInSite(req.scope, await siteFromRequest(req), BRAND_SITE_SCOPE, req.params.brand_id as string);

  const brand_id = req.params.brand_id as string;
  const query = req.scope.resolve('query');

  const { data: brandImages } = await query.graph({
    entity: 'brand_image',
    fields: ['*'],
    filters: {
      brand_id,
    },
  });

  res.status(200).json({ images: brandImages });
}
