import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import type { z } from 'zod';
import { GiftCardSettingsUpdate } from '../validators';
type Input = z.infer<typeof GiftCardSettingsUpdate>;
export declare function GET(req: MedusaRequest, res: MedusaResponse): Promise<void>;
export declare function POST(req: MedusaRequest<Input>, res: MedusaResponse): Promise<void>;
export {};
