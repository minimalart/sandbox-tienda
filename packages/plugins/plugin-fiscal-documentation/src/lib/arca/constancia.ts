import { XMLParser } from 'fast-xml-parser';
import { extractSoapFault } from './wsaa';
import { ArcaNotFoundError, ArcaUnavailableError, type WsaaTicket } from './types';

/**
 * ws_sr_constancia_inscripcion (personaServiceA5) — getPersona_v2.
 * La respuesta SOAP cruda NUNCA sale de este módulo ni se loguea.
 */

const REQUEST_TIMEOUT_MS = 8_000;

/** Shape laxo de personaReturn: campos que consume el mapper. */
export type PersonaReturn = {
  datosGenerales?: {
    razonSocial?: string;
    apellido?: string;
    nombre?: string;
    estadoClave?: string;
    domicilioFiscal?: {
      direccion?: string;
      localidad?: string;
      descripcionProvincia?: string;
      codPostal?: string;
    };
  };
  datosRegimenGeneral?: {
    impuesto?: Array<{ idImpuesto?: string; descripcionImpuesto?: string; estado?: string }>;
  };
  datosMonotributo?: Record<string, unknown>;
  errorConstancia?: { error?: string | string[] };
};

// `impuesto` puede venir como objeto único o array según el contribuyente.
const parser = new XMLParser({
  ignoreAttributes: true,
  removeNSPrefix: true,
  parseTagValue: false,
  trimValues: true,
  isArray: (name) => name === 'impuesto',
});

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildGetPersonaEnvelope(params: {
  token: string;
  sign: string;
  cuitRepresentada: string;
  idPersona: string;
}): string {
  return `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:a5="http://a5.soap.ws.server.puc.sr/">
  <soapenv:Header/>
  <soapenv:Body>
    <a5:getPersona_v2>
      <token>${escapeXml(params.token)}</token>
      <sign>${escapeXml(params.sign)}</sign>
      <cuitRepresentada>${params.cuitRepresentada}</cuitRepresentada>
      <idPersona>${params.idPersona}</idPersona>
    </a5:getPersona_v2>
  </soapenv:Body>
</soapenv:Envelope>`;
}

/** Parsea la respuesta SOAP de getPersona_v2 (exportado para tests). */
export function parsePersonaResponse(soapXml: string): PersonaReturn {
  const fault = extractSoapFault(soapXml);
  if (fault) {
    if (/no existe persona/i.test(fault)) throw new ArcaNotFoundError();
    throw new ArcaUnavailableError();
  }
  let personaReturn: PersonaReturn | undefined;
  try {
    const parsed = parser.parse(soapXml) as {
      Envelope?: {
        Body?: {
          getPersona_v2Response?: { personaReturn?: PersonaReturn };
          getPersonaResponse?: { personaReturn?: PersonaReturn };
        };
      };
    };
    const responseBody = parsed?.Envelope?.Body;
    personaReturn =
      responseBody?.getPersona_v2Response?.personaReturn ??
      responseBody?.getPersonaResponse?.personaReturn;
  } catch {
    personaReturn = undefined;
  }
  if (!personaReturn) {
    throw new ArcaUnavailableError('ARCA devolvió una respuesta que no se pudo interpretar.');
  }
  const constanciaErrors = personaReturn.errorConstancia?.error;
  if (constanciaErrors) {
    const messages = Array.isArray(constanciaErrors) ? constanciaErrors : [constanciaErrors];
    if (messages.some((m) => /no existe persona/i.test(String(m)))) throw new ArcaNotFoundError();
    throw new ArcaUnavailableError();
  }
  return personaReturn;
}

export async function callGetPersona(opts: {
  ticket: WsaaTicket;
  cuitRepresentada: string;
  idPersona: string;
  padronUrl: string;
  fetchImpl?: typeof globalThis.fetch;
}): Promise<PersonaReturn> {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetchImpl(opts.padronUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: '' },
      body: buildGetPersonaEnvelope({
        token: opts.ticket.token,
        sign: opts.ticket.sign,
        cuitRepresentada: opts.cuitRepresentada,
        idPersona: opts.idPersona,
      }),
      signal: controller.signal,
    });
  } catch {
    throw new ArcaUnavailableError();
  } finally {
    clearTimeout(timer);
  }
  const body = await response.text().catch(() => '');
  // Los faults llegan con HTTP 500: parsePersonaResponse los interpreta.
  if (!body) throw new ArcaUnavailableError();
  return parsePersonaResponse(body);
}
