/**
 * Capa B2B / Mayorista. La Company compra en el canal Wholesale; las órdenes
 * quedan a su nombre con trazabilidad del operador que las realizó.
 */
export type CompanyStatus = 'pending' | 'active' | 'suspended' | 'archived';
export type CompanyRole = 'owner' | 'admin' | 'buyer' | 'viewer';
export type CompanyMemberStatus = 'invited' | 'active' | 'disabled';
export type CompanyInvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

/** Roles que gestionan (empresa/usuarios). */
export const COMPANY_MANAGER_ROLES: CompanyRole[] = ['owner', 'admin'];
/** Roles que pueden comprar. */
export const COMPANY_BUYER_ROLES: CompanyRole[] = ['owner', 'admin', 'buyer'];

export const COMPANY_MODULE = 'company';
