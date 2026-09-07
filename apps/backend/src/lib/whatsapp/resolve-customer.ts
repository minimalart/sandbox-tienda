import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { MedusaContainer } from '@medusajs/framework/types';

export type ResolvedWaCustomer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  /** Pedidos del cliente, más recientes primero. */
  orders: Array<{ id: string; display_id: number | null; created_at: string | null }>;
};

/**
 * Genera variantes plausibles de un teléfono para hacer match contra el campo
 * `customer.phone`, que puede estar guardado en formatos distintos (con/sin `+`,
 * con/sin código de país `54`, con/sin el `9` de celular AR).
 *
 * Ej. entrante Meta `5491155551234` → ['5491155551234','+5491155551234',
 * '541155551234','1155551234','91155551234', ...].
 */
export function buildPhoneCandidates(raw: string): string[] {
  const digits = raw.replace(/\D+/g, '');
  if (!digits) return [];
  const set = new Set<string>();
  const add = (v: string) => {
    if (!v) return;
    set.add(v);
    set.add(`+${v}`);
  };

  add(digits);

  // Sacar código de país AR (54) y el 9 de celular, y reconstruir variantes.
  let local = digits;
  if (local.startsWith('54')) local = local.slice(2);
  if (local.startsWith('9')) local = local.slice(1);
  add(local); // número local sin país ni 9 (ej. 1155551234)
  add(`54${local}`);
  add(`549${local}`);
  add(`9${local}`);

  return [...set];
}

/**
 * Resuelve el cliente (y sus pedidos recientes) a partir del teléfono del
 * remitente de WhatsApp. Devuelve null si ningún cliente matchea — el bot en ese
 * caso pide número de pedido + un dato de verificación en vez de revelar nada.
 *
 * Nota: hoy matchea por `customer.phone`. Los pedidos de invitado cuyo teléfono
 * vive solo en la dirección de envío quedan fuera (follow-up).
 */
export async function resolveWaCustomer(
  container: MedusaContainer,
  fromPhone: string,
): Promise<ResolvedWaCustomer | null> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const candidates = buildPhoneCandidates(fromPhone);
  if (candidates.length === 0) return null;

  const { data: customers } = await query.graph({
    entity: 'customer',
    fields: [
      'id',
      'first_name',
      'last_name',
      'email',
      'phone',
      'orders.id',
      'orders.display_id',
      'orders.created_at',
    ],
    filters: { phone: candidates },
  });

  const customer = customers?.[0];
  if (!customer) return null;

  const orders = (customer.orders ?? [])
    .map((o: any) => ({
      id: o.id as string,
      display_id: (o.display_id ?? null) as number | null,
      created_at: (o.created_at ?? null) as string | null,
    }))
    .sort((a: any, b: any) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return tb - ta;
    });

  const name = [customer.first_name, customer.last_name].filter(Boolean).join(' ').trim();
  return {
    id: customer.id,
    name,
    email: customer.email ?? null,
    phone: customer.phone ?? null,
    orders,
  };
}
