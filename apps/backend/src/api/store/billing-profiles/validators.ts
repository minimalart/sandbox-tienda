import { z } from 'zod';
import { validateCuit } from '../../../modules/billing-profile/types';

const cuit = z
  .string()
  .refine(validateCuit, 'CUIT inválido (revisá los 11 dígitos y el verificador).');

/** Campos fiscales requeridos para Factura A. */
const billingCore = {
  tax_condition: z.enum([
    'responsable_inscripto',
    'monotributo',
    'exento',
    'consumidor_final',
  ]),
  document_type: z.literal('CUIT').default('CUIT'),
  document_number: cuit,
  legal_name: z.string().min(1, 'Razón social requerida.'),
  billing_email: z.string().email('Email de facturación inválido.'),
  billing_phone: z.string().optional().nullable(),
  address_line_1: z.string().min(1, 'Domicilio fiscal requerido.'),
  address_line_2: z.string().optional().nullable(),
  city: z.string().min(1, 'Localidad requerida.'),
  province: z.string().min(1, 'Provincia requerida.'),
  postal_code: z.string().min(1, 'Código postal requerido.'),
  country_code: z.string().min(2).default('ar'),
};

export const PostCreateProfile = z.object({
  label: z.string().min(1, 'Etiqueta requerida.'),
  invoice_type: z.literal('invoice_a').optional(),
  ...billingCore,
  is_default: z.boolean().optional(),
});

export const PutUpdateProfile = z
  .object({
    label: z.string().min(1).optional(),
    tax_condition: billingCore.tax_condition.optional(),
    document_type: z.literal('CUIT').optional(),
    document_number: cuit.optional(),
    legal_name: z.string().min(1).optional(),
    billing_email: z.string().email().optional(),
    billing_phone: z.string().optional().nullable(),
    address_line_1: z.string().min(1).optional(),
    address_line_2: z.string().optional().nullable(),
    city: z.string().min(1).optional(),
    province: z.string().min(1).optional(),
    postal_code: z.string().min(1).optional(),
    country_code: z.string().min(2).optional(),
    is_default: z.boolean().optional(),
  });

/** Datos fiscales one-time (label opcional) para asociar al cart sin guardar perfil. */
export const billingDataSchema = z.object({
  label: z.string().optional().nullable(),
  ...billingCore,
  // Verificación ARCA: solo aplica al snapshot por compra, no a perfiles guardados.
  arca_verified: z.boolean().optional(),
  arca_verified_at: z.string().datetime({ offset: true }).optional().nullable(),
  arca_lookup_cuit: z.string().optional().nullable(),
});

/** Body de POST /store/carts/:id/billing-profile. */
export const PostCartBilling = z.union([
  z.object({ billing_profile_id: z.string().min(1) }),
  z.object({
    invoice_type: z.literal('invoice_a'),
    billing_data: billingDataSchema,
  }),
  z.object({ invoice_type: z.literal('final_consumer') }),
]);
