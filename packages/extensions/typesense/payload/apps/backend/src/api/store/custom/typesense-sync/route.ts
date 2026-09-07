import { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { loadSyncProducts } from './loader';

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const result = await loadSyncProducts(req.scope);
    if (!result.ok) {
      res.status(result.status).json({ message: result.message });
      return;
    }
    res.status(200).json({ products: result.products });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[typesense-sync] Failed:', err.message, err.stack);
    res.status(500).json({
      message: `Typesense sync failed: ${err.message}`,
    });
  }
}
