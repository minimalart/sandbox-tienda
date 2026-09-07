import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
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
