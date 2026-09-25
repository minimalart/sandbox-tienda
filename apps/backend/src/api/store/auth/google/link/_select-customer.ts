/**
 * Elige, entre los customers que matchean el email verificado por Google, cuál
 * vincular a la auth identity.
 *
 * Un mismo email puede tener MÁS de una fila: un invitado (`has_account: false`,
 * creado por un checkout guest) y, aparte, una cuenta real. Preferimos SIEMPRE
 * la cuenta real — vincular la fila invitada le daría capacidad de login sin
 * corregir el flag, dejando al usuario en un estado inconsistente (puede
 * loguearse pero el storefront lo sigue tratando como invitado: carrito
 * "guest" para siempre, órdenes que no aparecen en su cuenta). Sólo si NO hay
 * ninguna cuenta real caemos al invitado.
 */
export interface LinkableCustomerLike {
  id: string;
  email?: string | null;
  has_account?: boolean | null;
}

export function selectLinkableCustomer<T extends LinkableCustomerLike>(
  customers: T[] | null | undefined,
): T | undefined {
  const list = customers ?? [];
  return list.find((c) => c.has_account === true) ?? list[0];
}
