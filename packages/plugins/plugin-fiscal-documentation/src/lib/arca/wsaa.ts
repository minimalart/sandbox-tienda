import forge from 'node-forge';
import { XMLParser } from 'fast-xml-parser';
import { getArcaConfig, type ArcaConfig } from './config';
import { ArcaUnavailableError, type ArcaCache, type WsaaTicket } from './types';

/**
 * WSAA — Web Service de Autenticación y Autorización de ARCA.
 *
 * Flujo: TRA XML → firma CMS/PKCS#7 (cert X.509 + clave privada) → loginCms
 * SOAP → ticket { token, sign } con vigencia ~12h, cacheado hasta expiración
 * menos margen.
 *
 * PROHIBIDO loguear token, sign, PEMs o XML crudo de request/response: el
 * ticket habilita a operar ante ARCA en nombre de la CUIT representada.
 */

const REQUEST_TIMEOUT_MS = 8_000;
/** Renovar el ticket 5 min antes de que venza. */
const TICKET_MARGIN_MS = 5 * 60 * 1000;
/** Tolerancia a clock skew en la ventana del TRA (práctica estándar AFIP). */
const TRA_SKEW_MS = 10 * 60 * 1000;

const parser = new XMLParser({
  ignoreAttributes: true,
  removeNSPrefix: true,
  parseTagValue: false,
  trimValues: true,
});

export function buildTra(service: string, now: Date): string {
  const generation = new Date(now.getTime() - TRA_SKEW_MS).toISOString();
  const expiration = new Date(now.getTime() + TRA_SKEW_MS).toISOString();
  const uniqueId = Math.floor(now.getTime() / 1000);
  return `<?xml version="1.0" encoding="UTF-8"?>
<loginTicketRequest version="1.0">
  <header>
    <uniqueId>${uniqueId}</uniqueId>
    <generationTime>${generation}</generationTime>
    <expirationTime>${expiration}</expirationTime>
  </header>
  <service>${service}</service>
</loginTicketRequest>`;
}

/** Firma el TRA como CMS/PKCS#7 attached (SHA-256) y lo devuelve en base64. */
export function signTraCms(tra: string, certPem: string, keyPem: string): string {
  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(tra, 'utf8');
  const certificate = forge.pki.certificateFromPem(certPem);
  p7.addCertificate(certificate);
  p7.addSigner({
    key: forge.pki.privateKeyFromPem(keyPem) as forge.pki.rsa.PrivateKey,
    certificate,
    digestAlgorithm: forge.pki.oids.sha256!,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType!, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest! },
      // Sin value: forge estampa la hora actual.
      { type: forge.pki.oids.signingTime! },
    ],
  });
  p7.sign();
  return forge.util.encode64(forge.asn1.toDer(p7.toAsn1()).getBytes());
}

export function buildLoginCmsEnvelope(cmsBase64: string): string {
  return `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov">
  <soapenv:Header/>
  <soapenv:Body>
    <wsaa:loginCms>
      <wsaa:in0>${cmsBase64}</wsaa:in0>
    </wsaa:loginCms>
  </soapenv:Body>
</soapenv:Envelope>`;
}

/** Extrae el faultstring de un envelope SOAP, o null si no hay fault. */
export function extractSoapFault(xml: string): string | null {
  try {
    const parsed = parser.parse(xml) as {
      Envelope?: { Body?: { Fault?: { faultstring?: string } } };
    };
    return parsed?.Envelope?.Body?.Fault?.faultstring ?? null;
  } catch {
    return null;
  }
}

/**
 * Parsea la respuesta de loginCms: el envelope trae loginTicketResponse como
 * string XML escapado dentro de loginCmsReturn (el parser decodifica entidades).
 */
export function parseLoginTicketResponse(soapXml: string): WsaaTicket {
  let inner: string | undefined;
  try {
    const parsed = parser.parse(soapXml) as {
      Envelope?: { Body?: { loginCmsResponse?: { loginCmsReturn?: string } } };
    };
    inner = parsed?.Envelope?.Body?.loginCmsResponse?.loginCmsReturn;
  } catch {
    inner = undefined;
  }
  if (!inner) {
    throw new ArcaUnavailableError('WSAA devolvió una respuesta que no se pudo interpretar.');
  }
  let ticket: { header?: { expirationTime?: string }; credentials?: { token?: string; sign?: string } };
  try {
    ticket = (parser.parse(inner) as { loginTicketResponse?: typeof ticket })?.loginTicketResponse ?? {};
  } catch {
    ticket = {};
  }
  const token = ticket.credentials?.token;
  const sign = ticket.credentials?.sign;
  const expiresAt = Date.parse(ticket.header?.expirationTime ?? '');
  if (!token || !sign || Number.isNaN(expiresAt)) {
    throw new ArcaUnavailableError('WSAA devolvió un ticket incompleto.');
  }
  return { token, sign, expiresAt };
}

/**
 * La IDENTIDAD del ticket. Es la clave del cache y la de la coalescencia.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ EL CUIT VA EN LA CLAVE, Y NO ES COSMÉTICO.                                │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Un TA de WSAA autoriza a operar EN NOMBRE DE LA CUIT que firmó el TRA. Hasta que
 * la configuración pasó a ser por tienda, la clave era `entorno:servicio` y eso
 * alcanzaba porque había una sola identidad en todo el backend. Con dos tiendas con
 * certificados distintos, esa clave hace que la tienda B reciba el ticket emitido
 * para la tienda A y consulte AFIP como el otro contribuyente — sin un solo error,
 * porque el ticket es perfectamente válido: lo que está mal es de quién es.
 *
 * El CUIT alcanza como discriminante y no hace falta hashear el certificado: dos
 * certificados del MISMO CUIT son la misma identidad fiscal (es exactamente el caso
 * de una renovación), y meter el PEM en una clave de cache sería material sensible
 * viajando a Redis en claro.
 */
const ticketIdentity = (cfg: ArcaConfig): string =>
  `${cfg.environment}:${cfg.service}:${cfg.cuitRepresentada}`;

/**
 * Requests concurrentes de la MISMA identidad comparten la emisión en curso: WSAA
 * rechaza pedir un TA teniendo uno vigente ("El CEE ya posee un TA valido").
 *
 * Es un Map y no una sola promesa por el mismo motivo que la clave lleva el CUIT:
 * con una sola, dos tiendas pidiendo su ticket a la vez recibían las dos el de la
 * que llegó primero. La entrada se borra al terminar, así que el Map no crece.
 */
const pendingTickets = new Map<string, Promise<WsaaTicket>>();

export async function getWsaaTicket(opts: {
  cache: ArcaCache;
  fetchImpl?: typeof globalThis.fetch;
  /**
   * La config de LA TIENDA. Sin esto se usa la de la INSTANCIA, que es lo correcto
   * sólo para los call sites que no tienen contenedor: ver el cartel de `config.ts`.
   */
  config?: ArcaConfig;
}): Promise<WsaaTicket> {
  const cfg = opts.config ?? getArcaConfig();
  const identity = ticketIdentity(cfg);
  const cacheKey = `arca:wsaa:ta:${identity}`;
  const cached = await opts.cache.get<WsaaTicket>(cacheKey);
  if (cached && cached.expiresAt - TICKET_MARGIN_MS > Date.now()) {
    return cached;
  }
  const inFlight = pendingTickets.get(identity);
  if (inFlight) return inFlight;

  const promise = requestNewTicket(cfg, opts.cache, cacheKey, opts.fetchImpl ?? globalThis.fetch);
  pendingTickets.set(identity, promise);
  try {
    return await promise;
  } finally {
    pendingTickets.delete(identity);
  }
}

async function requestNewTicket(
  cfg: ArcaConfig,
  cache: ArcaCache,
  cacheKey: string,
  fetchImpl: typeof globalThis.fetch
): Promise<WsaaTicket> {
  const tra = buildTra(cfg.service, new Date());
  const cms = signTraCms(tra, cfg.certificatePem, cfg.privateKeyPem);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetchImpl(cfg.urls.wsaa, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: '' },
      body: buildLoginCmsEnvelope(cms),
      signal: controller.signal,
    });
  } catch {
    throw new ArcaUnavailableError();
  } finally {
    clearTimeout(timer);
  }

  const body = await response.text().catch(() => '');
  // WSAA responde los faults con HTTP 500: mirar el body antes que el status.
  const fault = extractSoapFault(body);
  if (fault) {
    if (/ya posee un TA valido/i.test(fault)) {
      // Otro proceso/container pudo haber emitido el TA entre nuestro miss y
      // este POST: re-leer el cache antes de rendirse.
      const existing = await cache.get<WsaaTicket>(cacheKey);
      if (existing && existing.expiresAt > Date.now()) return existing;
      throw new ArcaUnavailableError(
        'WSAA reporta un ticket vigente emitido por otro proceso. Reintentá en unos minutos.'
      );
    }
    throw new ArcaUnavailableError();
  }
  if (!response.ok) throw new ArcaUnavailableError();

  const ticket = parseLoginTicketResponse(body);
  const ttlSeconds = Math.max(60, Math.floor((ticket.expiresAt - Date.now() - TICKET_MARGIN_MS) / 1000));
  await cache.set(cacheKey, ticket, ttlSeconds);
  return ticket;
}
