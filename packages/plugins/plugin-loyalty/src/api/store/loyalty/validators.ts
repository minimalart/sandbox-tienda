import { z } from 'zod';

export const RedeemSchema = z.object({
  reward_id: z.string().min(1),
  sales_channel_id: z.string().nullish(),
});
