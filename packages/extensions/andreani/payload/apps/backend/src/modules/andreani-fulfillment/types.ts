/**
 * Andreani fulfillment provider — type definitions.
 *
 * Simplified, env-credentialed port. No data models / multi-tenant types.
 */

export type AndreaniServiceType = 'Domicilio' | 'Sucursal' | 'PuntoDeTercero';

/**
 * Contrato por servicio. `undefined` = usar el contrato base.
 *
 * Vive acá y no en `settings.ts` para que `env-options.ts` no tenga que importar de
 * `settings.ts`: el ciclo sería sólo de tipos (y por lo tanto se borra en runtime),
 * pero `env-options.ts` es el módulo que `medusa-config.ts` requiere en el boot y
 * conviene que su grafo de imports no toque nada que lea la base ni siquiera de
 * mentira.
 */
export type AndreaniContractOverrides = Record<AndreaniServiceType, string | undefined>;

/**
 * Provider options sourced from environment variables in medusa-config.ts.
 */
export interface AndreaniProviderOptions {
  hostname: string;
  username: string;
  password: string;
  contract: string;
  clientCode?: string;
  testMode: boolean;
  sender: {
    name: string;
    email?: string;
    phone?: string;
    documentType?: string;
    documentNumber?: string;
  };
  origin: {
    postalCode: string;
    street: string;
    number: string;
    city: string;
    province: string;
  };
  /**
   * Opt-in fallback for products missing physical dimensions/weight. When
   * `enabled` is false (default) the box-packer stays strict and aborts label
   * creation for such products.
   */
  dimensionFallback: {
    enabled: boolean;
    length: number; // cm
    width: number; // cm
    height: number; // cm
    weight: number; // kg per unit
  };
}

// --- Andreani API payloads ---

export interface AndreaniPostalAddress {
  codigoPostal: string;
  calle: string;
  numero: string;
  localidad: string;
}

export interface AndreaniPostalDestination {
  postal: AndreaniPostalAddress;
}

export interface AndreaniSucursalDestination {
  sucursal: {
    id: string;
    direccion: AndreaniPostalAddress;
  };
}

export type AndreaniShipmentDestination =
  | AndreaniPostalDestination
  | AndreaniSucursalDestination;

export interface BultoData {
  kilos: number;
  largoCm: number;
  altoCm: number;
  anchoCm: number;
  volumenCm: number;
  valorDeclaradoSinImpuestos: number;
  valorDeclaradoConImpuestos: number;
  referencias?: Array<{ meta: string; contenido: string }>;
}

export interface AndreaniContactParty {
  nombreCompleto: string;
  email?: string;
  documentoTipo?: string;
  documentoNumero?: string;
  telefonos?: Array<{ tipo: number; numero: string }>;
}

export interface AndreaniCreateShipmentRequest {
  contrato: string;
  cliente?: string;
  tipoServicio: AndreaniServiceType;
  origen: { postal: AndreaniPostalAddress };
  destino: AndreaniShipmentDestination;
  remitente: AndreaniContactParty;
  destinatario: AndreaniContactParty[];
  bultos: BultoData[];
}

export interface AndreaniAuthResponse {
  token: string;
  refreshToken?: string;
}

export interface AndreaniRateResponse {
  tarifas: Array<{
    tipoServicio: string;
    precio: number;
    plazoEntrega: number;
  }>;
}

export interface AndreaniShipmentResponse {
  numeroDeEnvio?: string;
  etiqueta?: string;
  agrupadorDeBultos?: string;
  etiquetasPorAgrupador?: string;
  bultos?: Array<{
    numeroDeBulto?: string;
    numeroDeEnvio?: string;
    totalizador?: string;
    linking?: Array<{ meta: string; contenido: string }>;
  }>;
}

export interface AndreaniTrackingResponse {
  trazas?: Array<{
    fecha?: string;
    estado?: string;
    descripcion?: string;
    ubicacion?: string;
  }>;
  fechaEstimadaEntrega?: string;
  origen?: string;
  destino?: string;
  tipoServicio?: string;
}

export interface TrackingEvent {
  timestamp: string;
  status: string;
  description: string;
  location?: string;
}

/**
 * Estado de un envío (GET /v2/envios/{id}). Usado por el job de sync para
 * detectar transiciones: estadoId >= 5 (admitido) → shipped; estadoId === 18
 * (entregado) → delivered.
 */
export interface AndreaniShipmentStatusResponse {
  estadoId?: number;
  estado?: string;
  numeroDeEnvio?: string;
  fechaEstimadaDeEntrega?: string;
  [key: string]: unknown;
}

/**
 * Trazas en formato `{ eventos: [...] }` (GET /v2/envios/{id}/trazas).
 * Distinto del formato `{ trazas: [...] }` de AndreaniTrackingResponse.
 */
export interface AndreaniTrazasResponse {
  eventos?: Array<{
    Fecha?: string;
    Estado?: string;
    Evento?: string;
    Sucursal?: string;
    [key: string]: unknown;
  }>;
}

/**
 * Rate query params for the Andreani cotizacion endpoint.
 */
export interface AndreaniRateRequest {
  cpDestino: string;
  // Optional per-service contract. Andreani quotes each service (Domicilio /
  // Sucursal / PuntoDeTercero) under a specific contract, so the caller may
  // override the client's base contract. Falls back to the base when omitted.
  contrato?: string;
  bultos: Array<{
    valorDeclarado: number;
    volumen: number;
    kilos: number;
    altoCm?: number;
    largoCm?: number;
    anchoCm?: number;
  }>;
}
