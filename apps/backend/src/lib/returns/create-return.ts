import { createAndCompleteReturnOrderWorkflow } from '@medusajs/core-flows';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { MedusaContainer } from '@medusajs/framework/types';

export type CreateReturnItem = {
  /** ID de la LÍNEA de la orden (order_line_item), NO el variant_id. */
  id: string;
  quantity: number;
  reason_id?: string | null;
  note?: string | null;
};

export type CreateReturnInput = {
  order_id: string;
  items: CreateReturnItem[];
  return_shipping_option_id: string;
  note?: string | null;
  location_id?: string | null;
};

/**
 * Crea y completa una devolución (return) usando el mismo workflow que la store
 * API (`POST /store/returns`). Lo usa el bot de WhatsApp server-side; el storefront
 * pega directo a la ruta. El admin recibe/procesa el return desde el dashboard.
 */
export async function createOrderReturn(
  container: MedusaContainer,
  input: CreateReturnInput,
): Promise<{ id: string }> {
  const { result } = await createAndCompleteReturnOrderWorkflow(container as any).run({
    input: {
      order_id: input.order_id,
      items: input.items.map((i) => ({
        id: i.id,
        quantity: i.quantity,
        reason_id: i.reason_id ?? undefined,
        note: i.note ?? undefined,
      })),
      return_shipping: { option_id: input.return_shipping_option_id },
      note: input.note ?? undefined,
      location_id: input.location_id ?? undefined,
    } as any,
  });
  return { id: (result as { id?: string })?.id ?? '' };
}

/**
 * Resuelve una opción de envío de devolución para la región del pedido. Las
 * return shipping options se marcan con la regla `is_return: "true"`. Devuelve la
 * primera disponible, o null (→ el caller degrada con un mensaje claro).
 */
export async function resolveReturnShippingOption(
  container: MedusaContainer,
  regionId?: string | null,
): Promise<string | null> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  try {
    const { data: options } = await query.graph({
      entity: 'shipping_option',
      fields: ['id', 'name', 'rules.attribute', 'rules.value'],
    });
    const isReturn = (o: any) =>
      Array.isArray(o?.rules) &&
      o.rules.some(
        (r: any) => r?.attribute === 'is_return' && String(r?.value) === 'true',
      );
    const returnOpts = (options as any[]).filter(isReturn);
    if (returnOpts.length === 0) return null;
    // Sin más señal de región, tomamos la primera return option disponible.
    void regionId;
    return returnOpts[0].id as string;
  } catch {
    return null;
  }
}
