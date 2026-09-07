import { z } from "zod";

/** transfer-request: validación server-side del ID de pedido a vincular. */
export const transferRequestSchema = z.object({
  order_id: z.string().trim().min(1, "El ID del pedido es obligatorio"),
});
export type TransferRequestInput = z.infer<typeof transferRequestSchema>;
