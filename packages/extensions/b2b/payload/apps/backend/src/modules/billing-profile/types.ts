/**
 * Perfiles de facturación (Factura A AR). Entidad propia reutilizable por
 * customer; el snapshot fiscal de cada compra se guarda en order.metadata.
 */

export type InvoiceType = 'final_consumer' | 'invoice_a';

export type TaxCondition =
  | 'responsable_inscripto'
  | 'monotributo'
  | 'exento'
  | 'consumidor_final';

export type DocumentType = 'CUIT' | 'DNI';

/** Snapshot fiscal persistido en cart.metadata / order.metadata. */
export type BillingSnapshot = {
  label?: string | null;
  tax_condition: TaxCondition;
  document_type: DocumentType;
  document_number: string;
  legal_name: string;
  billing_email: string;
  billing_phone?: string | null;
  address_line_1: string;
  address_line_2?: string | null;
  city: string;
  province: string;
  postal_code: string;
  country_code: string;
  /**
   * Verificación contra el padrón de ARCA (botón "Buscar en ARCA" del
   * checkout). Informativa: la reporta el cliente y el backend solo valida
   * que el CUIT consultado coincida con el del snapshot.
   */
  arca_verified?: boolean;
  arca_verified_at?: string | null;
  arca_lookup_cuit?: string | null;
};

/**
 * Valida un CUIT argentino: 11 dígitos + dígito verificador (módulo 11).
 * Acepta con o sin guiones; valida sobre los dígitos.
 */
export function validateCuit(cuit: string | null | undefined): boolean {
  if (!cuit) return false;
  const clean = String(cuit).replace(/\D/g, '');
  if (clean.length !== 11) return false;
  const mult = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += Number(clean[i]) * mult[i]!;
  }
  let check = 11 - (sum % 11);
  if (check === 11) check = 0;
  if (check === 10) return false; // CUIT inválido por convención
  return check === Number(clean[10]);
}

export const BILLING_PROFILE_MODULE = 'billing_profile';
