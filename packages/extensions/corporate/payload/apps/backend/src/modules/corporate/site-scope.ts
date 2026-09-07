import type { SiteScopeDescriptor } from '../../lib/multistore/scope';

/**
 * La empresa es la raíz del dominio B2B; todo lo demás hereda su tienda.
 *
 * `empty: 'all'`: las empresas anteriores a la columna se ven desde cualquier tienda.
 * Esconder una cuenta B2B viva el día del deploy le cortaría el acceso al comprador
 * sin que nadie lo haya decidido, y el operador tardaría en relacionar una cosa con
 * la otra.
 */
export const CORPORATE_SITE_SCOPE: SiteScopeDescriptor = {
  kind: 'site_column',
  table: 'corporate',
  column: 'site_id',
  empty: 'all',
};

/** Miembros, reglas e invitaciones cuelgan de la empresa. Sin empresa no existen. */
const viaCorporate = (table: string): SiteScopeDescriptor => ({
  kind: 'via_parent',
  table,
  fk: 'corporate_id',
  parent: CORPORATE_SITE_SCOPE,
  empty: 'unassigned',
});

export const CORPORATE_MEMBER_SITE_SCOPE = viaCorporate('corporate_member');
export const CORPORATE_RULE_SITE_SCOPE = viaCorporate('corporate_rule');
export const CORPORATE_INVITATION_SITE_SCOPE = viaCorporate('corporate_invitation');
