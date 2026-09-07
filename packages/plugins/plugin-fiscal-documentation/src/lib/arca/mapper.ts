import type { PersonaReturn } from './constancia';
import type { ArcaTaxCondition, NormalizedTaxpayer } from './types';

/**
 * Normaliza la respuesta irregular del padrón al modelo del checkout.
 * Defensivo a propósito: nunca lanza por campo faltante, degrada a string
 * vacío (los campos quedan editables en el form).
 */

/** Impuestos del régimen general relevantes para la condición IVA. */
const IMPUESTO_IVA = '30';
const IMPUESTO_IVA_EXENTO = '32';

function asText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function resolveTaxCondition(persona: PersonaReturn): ArcaTaxCondition {
  const mono = persona.datosMonotributo;
  if (mono && typeof mono === 'object' && Object.keys(mono).length > 0) {
    return 'monotributo';
  }
  const impuestos = (persona.datosRegimenGeneral?.impuesto ?? []).filter((imp) => {
    const estado = asText(imp?.estado).toUpperCase();
    return !estado || estado.startsWith('AC');
  });
  const ids = impuestos.map((imp) => asText(imp?.idImpuesto));
  if (ids.includes(IMPUESTO_IVA_EXENTO)) return 'exento';
  if (ids.includes(IMPUESTO_IVA)) return 'responsable_inscripto';
  return 'consumidor_final';
}

export function mapPersonaToTaxpayer(persona: PersonaReturn, cuit: string): NormalizedTaxpayer {
  const generales = persona.datosGenerales ?? {};
  const domicilio = generales.domicilioFiscal ?? {};
  const razonSocial = asText(generales.razonSocial);
  const nombreCompleto = [asText(generales.apellido), asText(generales.nombre)]
    .filter(Boolean)
    .join(' ');
  const provincia = asText(domicilio.descripcionProvincia);
  return {
    cuit,
    legal_name: razonSocial || nombreCompleto,
    tax_condition: resolveTaxCondition(persona),
    status: asText(generales.estadoClave),
    address: {
      address_line_1: asText(domicilio.direccion),
      // CABA viene sin localidad: cae a la provincia.
      city: asText(domicilio.localidad) || provincia,
      province: provincia,
      postal_code: asText(domicilio.codPostal),
      country_code: 'ar',
    },
    source: 'arca',
    verified_at: new Date().toISOString(),
  };
}
