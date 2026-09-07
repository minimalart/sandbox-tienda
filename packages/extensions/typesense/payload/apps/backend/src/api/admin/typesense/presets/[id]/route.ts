import { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import TypeSenseService from '../../../../../modules/typesense/service';
import { PresetResponse, SearchPresetValue } from '../../../../../modules/typesense/types';

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const typesenseService = new TypeSenseService();
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ success: false, message: 'Preset ID is required' });
    }

    const preset = await typesenseService.getPreset(id);

    return res.status(200).json({
      success: true,
      data: preset,
      message: 'Preset retrieved successfully',
    } as PresetResponse);
  } catch (error) {
    console.error('Error retrieving preset:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve preset' });
  }
}

export async function PUT(req: MedusaRequest, res: MedusaResponse) {
  try {
    const typesenseService = new TypeSenseService();
    const { id } = req.params;
    const value = req.body as SearchPresetValue;

    if (!id) {
      return res.status(400).json({ success: false, message: 'Preset ID is required' });
    }

    if (!value || (!value.query_by && !value.sort_by)) {
      return res.status(400).json({
        success: false,
        message: 'Preset must have at least query_by or sort_by',
      });
    }

    const preset = await typesenseService.upsertPreset(id, value);

    return res.status(200).json({
      success: true,
      data: preset,
      message: 'Preset saved successfully',
    } as PresetResponse);
  } catch (error) {
    console.error('Error upserting preset:', error);
    return res.status(500).json({ success: false, message: 'Failed to save preset' });
  }
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  try {
    const typesenseService = new TypeSenseService();
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ success: false, message: 'Preset ID is required' });
    }

    await typesenseService.deletePreset(id);

    return res.status(200).json({ success: true, message: 'Preset deleted successfully' });
  } catch (error) {
    console.error('Error deleting preset:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete preset' });
  }
}
