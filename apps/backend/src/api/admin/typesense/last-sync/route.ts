import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import type { IStoreModuleService } from '@medusajs/framework/types';
import { ModuleRegistrationName } from '@medusajs/framework/utils';

const TYPESENSE_LAST_SYNC_METADATA_KEY = 'last_typesense_sync_at';

export interface LastSyncResponse {
  success: boolean;
  lastSyncAt: string | null;
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const storeModuleService = req.scope.resolve(
      ModuleRegistrationName.STORE
    ) as IStoreModuleService;
    const [store] = await storeModuleService.listStores();
    const lastSyncAt =
      (store?.metadata?.[TYPESENSE_LAST_SYNC_METADATA_KEY] as string | undefined) ?? null;
    return res.json({ success: true, lastSyncAt } as LastSyncResponse);
  } catch (error) {
    console.error('[ADMIN][typesense/last-sync] GET failed', error);
    return res.status(500).json({ success: false, lastSyncAt: null } as LastSyncResponse);
  }
}
