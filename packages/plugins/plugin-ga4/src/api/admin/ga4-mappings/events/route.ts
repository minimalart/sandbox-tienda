import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import {
  GA4_EVENT_CATEGORY_ORDER,
  MANAGED_GA4_EVENTS,
  SUPPORTED_EVENTS,
} from '../../../../modules/ga4/lib/supported-events';

export async function GET(_req: MedusaRequest, res: MedusaResponse): Promise<void> {
  res.status(200).json({
    events: SUPPORTED_EVENTS,
    categories: GA4_EVENT_CATEGORY_ORDER,
    managed: MANAGED_GA4_EVENTS,
  });
}
