/**
 * Integración ARCA (ex AFIP) — consulta de constancia de inscripción.
 *
 * Carpeta de funciones self-contained (sin modelos DB ni registro de módulo
 * Medusa), siguiendo el patrón de catalogador/ai/openrouter.ts. El único
 * consumidor es la ruta /store/arca/taxpayer-lookup.
 */

export type ArcaEnvironment = 'production' | 'homologacion';

/** Condición IVA normalizada (subset de TaxCondition de billing-profile). */
export type ArcaTaxCondition =
  | 'responsable_inscripto'
  | 'exento'
  | 'monotributo'
  | 'consumidor_final';

/** Respuesta normalizada del lookup — lo único que sale hacia el storefront. */
export type NormalizedTaxpayer = {
  cuit: string;
  legal_name: string;
  tax_condition: ArcaTaxCondition;
  status: string;
  address: {
    address_line_1: string;
    city: string;
    province: string;
    postal_code: string;
    country_code: 'ar';
  };
  source: 'arca';
  verified_at: string;
};

/** Ticket de acceso WSAA (vigencia ~12h). `expiresAt` en epoch ms. */
export type WsaaTicket = {
  token: string;
  sign: string;
  expiresAt: number;
};

/**
 * Cache mínima estructuralmente compatible con ICacheService de Medusa
 * (ttl en segundos). En tests se cubre con un Map fake.
 */
export type ArcaCache = {
  get<T>(key: string): Promise<T | null>;
  set(key: string, data: unknown, ttl?: number): Promise<void>;
};

export const ARCA_URLS: Record<ArcaEnvironment, { wsaa: string; padron: string }> = {
  production: {
    wsaa: 'https://wsaa.afip.gov.ar/ws/services/LoginCms',
    padron: 'https://aws.afip.gov.ar/sr-padron/webservices/personaServiceA5',
  },
  homologacion: {
    wsaa: 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms',
    padron: 'https://awshomo.afip.gov.ar/sr-padron/webservices/personaServiceA5',
  },
};

/** Falta configuración (env ARCA_*) → 503 hacia el cliente. */
export class ArcaConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ArcaConfigError';
  }
}

/** CUIT con formato/verificador inválido → 400. */
export class ArcaInvalidCuitError extends Error {
  constructor(message = 'CUIT inválido (revisá los 11 dígitos y el verificador).') {
    super(message);
    this.name = 'ArcaInvalidCuitError';
  }
}

/** La persona no existe en el padrón → 404. */
export class ArcaNotFoundError extends Error {
  constructor(message = 'No encontramos ese CUIT en ARCA.') {
    super(message);
    this.name = 'ArcaNotFoundError';
  }
}

/** ARCA caído / timeout / fault inesperado → 503 (el checkout sigue manual). */
export class ArcaUnavailableError extends Error {
  constructor(message = 'No pudimos consultar ARCA en este momento.') {
    super(message);
    this.name = 'ArcaUnavailableError';
  }
}
