/**
 * Siembra motivos de devolución (return reasons) base. El flujo de devolución
 * (storefront + WhatsApp) los ofrece al cliente; sin al menos uno, la solicitud
 * igual funciona (reason_id es opcional) pero no hay motivos para elegir.
 *
 * Idempotente: si ya existen motivos, no toca nada. Correr con:
 *   pnpm medusa exec ./src/scripts/seed-return-reasons.ts
 */
import type { ExecArgs, Logger } from '@medusajs/framework/types';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';

const REASONS: Array<{ value: string; label: string; description?: string }> = [
  { value: 'changed_mind', label: 'Cambié de opinión' },
  { value: 'wrong_size', label: 'Talle/medida equivocada' },
  { value: 'damaged', label: 'Llegó dañado' },
  { value: 'defective', label: 'Producto defectuoso' },
  { value: 'not_as_expected', label: 'No era lo que esperaba' },
  { value: 'wrong_item', label: 'Me llegó un producto equivocado' },
];

export default async function seedReturnReasons({ container }: ExecArgs) {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const orderService = container.resolve(Modules.ORDER) as {
    listReturnReasons: (f?: any, c?: any) => Promise<any[]>;
    createReturnReasons: (data: any) => Promise<any>;
  };

  const existing = await orderService.listReturnReasons({}, { take: 1 }).catch(() => []);
  if (existing.length > 0) {
    logger.info('[seed-return-reasons] Ya existen motivos de devolución → no se toca.');
    return;
  }

  await orderService.createReturnReasons(
    REASONS.map((r) => ({ value: r.value, label: r.label, description: r.description ?? null })),
  );
  logger.info(`[seed-return-reasons] Creados ${REASONS.length} motivos de devolución.`);
}
