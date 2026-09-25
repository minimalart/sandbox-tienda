import { validateCuit } from "../../../../lib/util/cuit";

/** Campos obligatorios de Factura A que se cargan a mano (modo "Crear nuevo"). */
export type InvoiceARequiredField =
  | "document_number"
  | "legal_name"
  | "billing_email"
  | "address_line_1"
  | "city"
  | "province"
  | "postal_code";

export const INVOICE_A_REQUIRED_FIELDS: readonly InvoiceARequiredField[] = [
  "document_number",
  "legal_name",
  "billing_email",
  "address_line_1",
  "city",
  "province",
  "postal_code",
];

type InvoiceAValues = Record<InvoiceARequiredField, string | null | undefined>;

const EMPTY_MESSAGES: Record<InvoiceARequiredField, string> = {
  document_number: "Ingresá el CUIT",
  legal_name: "Ingresá la razón social",
  billing_email: "Ingresá el email de facturación",
  address_line_1: "Ingresá el domicilio fiscal",
  city: "Ingresá la localidad",
  province: "Ingresá la provincia",
  postal_code: "Ingresá el código postal",
};

/**
 * Un mensaje por campo, con el mismo criterio que Datos personales: dice qué
 * falta en ESE campo en vez de un resumen genérico al pie del bloque.
 * Sin entradas = el bloque es válido.
 */
export function invoiceAFieldErrors(
  values: InvoiceAValues,
): Partial<Record<InvoiceARequiredField, string>> {
  const errors: Partial<Record<InvoiceARequiredField, string>> = {};
  for (const field of INVOICE_A_REQUIRED_FIELDS) {
    if (!values[field]?.trim()) errors[field] = EMPTY_MESSAGES[field];
  }
  if (!errors.document_number && !validateCuit(values.document_number)) {
    errors.document_number = "Ingresá un CUIT válido";
  }
  if (!errors.billing_email && !/.+@.+\..+/.test(values.billing_email ?? "")) {
    errors.billing_email = "Ingresá un email válido";
  }
  return errors;
}
