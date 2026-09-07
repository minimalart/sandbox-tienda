import { z } from "zod";
import { extractPhoneParts } from "@lib/util/phone";

/**
 * Fuente de verdad ÚNICA para la validación de teléfonos.
 *
 * El `PhoneInput` (react-international-phone, con `forceDialCode`) siempre
 * emite un string internacional completo, p. ej. "+5491112345678". Un campo
 * "vacío" en realidad llega como el dial code solo, p. ej. "+54" → 0 dígitos
 * nacionales. Validamos sobre el número nacional (10 dígitos para AR/UY).
 */
const NATIONAL_DIGITS = 10;

const hasValidNationalNumber = (value: string): boolean => {
  const { nationalNumber } = extractPhoneParts(value);
  return nationalNumber.length === NATIONAL_DIGITS;
};

const isEmptyPhone = (value: string): boolean => {
  const { nationalNumber } = extractPhoneParts(value);
  return nationalNumber.length === 0;
};

const PHONE_ERROR = "Ingresá un teléfono válido (10 dígitos)";

/** Teléfono obligatorio: debe tener 10 dígitos nacionales. */
export const phoneSchema = z
  .string()
  .refine(hasValidNationalNumber, { message: PHONE_ERROR });

/** Teléfono opcional: válido si está vacío o si tiene 10 dígitos nacionales. */
export const optionalPhoneSchema = z
  .string()
  .refine((value) => isEmptyPhone(value) || hasValidNationalNumber(value), {
    message: PHONE_ERROR,
  });
