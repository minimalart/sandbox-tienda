import { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import TypeSenseService from '../../../../modules/typesense/service';
import { PresetsResponse } from '../../../../modules/typesense/types';

export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  try {
    const typesenseService = new TypeSenseService();
    const presets = await typesenseService.getPresets();

    return res.status(200).json({
      success: true,
      data: presets,
      message: 'Presets retrieved successfully',
    } as PresetsResponse);
  } catch {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve presets',
    } as PresetsResponse);
  }
}
