"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildTra = buildTra;
exports.signTraCms = signTraCms;
exports.buildLoginCmsEnvelope = buildLoginCmsEnvelope;
exports.extractSoapFault = extractSoapFault;
exports.parseLoginTicketResponse = parseLoginTicketResponse;
exports.getWsaaTicket = getWsaaTicket;
const node_forge_1 = __importDefault(require("node-forge"));
const fast_xml_parser_1 = require("fast-xml-parser");
const config_1 = require("./config");
const types_1 = require("./types");
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
const parser = new fast_xml_parser_1.XMLParser({
    ignoreAttributes: true,
    removeNSPrefix: true,
    parseTagValue: false,
    trimValues: true,
});
function buildTra(service, now) {
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
function signTraCms(tra, certPem, keyPem) {
    const p7 = node_forge_1.default.pkcs7.createSignedData();
    p7.content = node_forge_1.default.util.createBuffer(tra, 'utf8');
    const certificate = node_forge_1.default.pki.certificateFromPem(certPem);
    p7.addCertificate(certificate);
    p7.addSigner({
        key: node_forge_1.default.pki.privateKeyFromPem(keyPem),
        certificate,
        digestAlgorithm: node_forge_1.default.pki.oids.sha256,
        authenticatedAttributes: [
            { type: node_forge_1.default.pki.oids.contentType, value: node_forge_1.default.pki.oids.data },
            { type: node_forge_1.default.pki.oids.messageDigest },
            // Sin value: forge estampa la hora actual.
            { type: node_forge_1.default.pki.oids.signingTime },
        ],
    });
    p7.sign();
    return node_forge_1.default.util.encode64(node_forge_1.default.asn1.toDer(p7.toAsn1()).getBytes());
}
function buildLoginCmsEnvelope(cmsBase64) {
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
function extractSoapFault(xml) {
    try {
        const parsed = parser.parse(xml);
        return parsed?.Envelope?.Body?.Fault?.faultstring ?? null;
    }
    catch {
        return null;
    }
}
/**
 * Parsea la respuesta de loginCms: el envelope trae loginTicketResponse como
 * string XML escapado dentro de loginCmsReturn (el parser decodifica entidades).
 */
function parseLoginTicketResponse(soapXml) {
    let inner;
    try {
        const parsed = parser.parse(soapXml);
        inner = parsed?.Envelope?.Body?.loginCmsResponse?.loginCmsReturn;
    }
    catch {
        inner = undefined;
    }
    if (!inner) {
        throw new types_1.ArcaUnavailableError('WSAA devolvió una respuesta que no se pudo interpretar.');
    }
    let ticket;
    try {
        ticket = parser.parse(inner)?.loginTicketResponse ?? {};
    }
    catch {
        ticket = {};
    }
    const token = ticket.credentials?.token;
    const sign = ticket.credentials?.sign;
    const expiresAt = Date.parse(ticket.header?.expirationTime ?? '');
    if (!token || !sign || Number.isNaN(expiresAt)) {
        throw new types_1.ArcaUnavailableError('WSAA devolvió un ticket incompleto.');
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
const ticketIdentity = (cfg) => `${cfg.environment}:${cfg.service}:${cfg.cuitRepresentada}`;
/**
 * Requests concurrentes de la MISMA identidad comparten la emisión en curso: WSAA
 * rechaza pedir un TA teniendo uno vigente ("El CEE ya posee un TA valido").
 *
 * Es un Map y no una sola promesa por el mismo motivo que la clave lleva el CUIT:
 * con una sola, dos tiendas pidiendo su ticket a la vez recibían las dos el de la
 * que llegó primero. La entrada se borra al terminar, así que el Map no crece.
 */
const pendingTickets = new Map();
async function getWsaaTicket(opts) {
    const cfg = opts.config ?? (0, config_1.getArcaConfig)();
    const identity = ticketIdentity(cfg);
    const cacheKey = `arca:wsaa:ta:${identity}`;
    const cached = await opts.cache.get(cacheKey);
    if (cached && cached.expiresAt - TICKET_MARGIN_MS > Date.now()) {
        return cached;
    }
    const inFlight = pendingTickets.get(identity);
    if (inFlight)
        return inFlight;
    const promise = requestNewTicket(cfg, opts.cache, cacheKey, opts.fetchImpl ?? globalThis.fetch);
    pendingTickets.set(identity, promise);
    try {
        return await promise;
    }
    finally {
        pendingTickets.delete(identity);
    }
}
async function requestNewTicket(cfg, cache, cacheKey, fetchImpl) {
    const tra = buildTra(cfg.service, new Date());
    const cms = signTraCms(tra, cfg.certificatePem, cfg.privateKeyPem);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response;
    try {
        response = await fetchImpl(cfg.urls.wsaa, {
            method: 'POST',
            headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: '' },
            body: buildLoginCmsEnvelope(cms),
            signal: controller.signal,
        });
    }
    catch {
        throw new types_1.ArcaUnavailableError();
    }
    finally {
        clearTimeout(timer);
    }
    const body = await response.text().catch(() => '');
    // WSAA responde los faults con HTTP 500: mirar el body antes que el status.
    const fault = extractSoapFault(body);
    if (fault) {
        if (/ya posee un TA valido/i.test(fault)) {
            // Otro proceso/container pudo haber emitido el TA entre nuestro miss y
            // este POST: re-leer el cache antes de rendirse.
            const existing = await cache.get(cacheKey);
            if (existing && existing.expiresAt > Date.now())
                return existing;
            throw new types_1.ArcaUnavailableError('WSAA reporta un ticket vigente emitido por otro proceso. Reintentá en unos minutos.');
        }
        throw new types_1.ArcaUnavailableError();
    }
    if (!response.ok)
        throw new types_1.ArcaUnavailableError();
    const ticket = parseLoginTicketResponse(body);
    const ttlSeconds = Math.max(60, Math.floor((ticket.expiresAt - Date.now() - TICKET_MARGIN_MS) / 1000));
    await cache.set(cacheKey, ticket, ttlSeconds);
    return ticket;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid3NhYS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9saWIvYXJjYS93c2FhLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBNkJBLDRCQWFDO0FBR0QsZ0NBa0JDO0FBRUQsc0RBU0M7QUFHRCw0Q0FTQztBQU1ELDREQTBCQztBQWtDRCxzQ0EwQkM7QUFsTEQsNERBQStCO0FBQy9CLHFEQUE0QztBQUM1QyxxQ0FBMEQ7QUFDMUQsbUNBQWdGO0FBRWhGOzs7Ozs7Ozs7R0FTRztBQUVILE1BQU0sa0JBQWtCLEdBQUcsS0FBSyxDQUFDO0FBQ2pDLGtEQUFrRDtBQUNsRCxNQUFNLGdCQUFnQixHQUFHLENBQUMsR0FBRyxFQUFFLEdBQUcsSUFBSSxDQUFDO0FBQ3ZDLDhFQUE4RTtBQUM5RSxNQUFNLFdBQVcsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLElBQUksQ0FBQztBQUVuQyxNQUFNLE1BQU0sR0FBRyxJQUFJLDJCQUFTLENBQUM7SUFDM0IsZ0JBQWdCLEVBQUUsSUFBSTtJQUN0QixjQUFjLEVBQUUsSUFBSTtJQUNwQixhQUFhLEVBQUUsS0FBSztJQUNwQixVQUFVLEVBQUUsSUFBSTtDQUNqQixDQUFDLENBQUM7QUFFSCxTQUFnQixRQUFRLENBQUMsT0FBZSxFQUFFLEdBQVM7SUFDakQsTUFBTSxVQUFVLEdBQUcsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLE9BQU8sRUFBRSxHQUFHLFdBQVcsQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDO0lBQ3ZFLE1BQU0sVUFBVSxHQUFHLElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxPQUFPLEVBQUUsR0FBRyxXQUFXLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQztJQUN2RSxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxPQUFPLEVBQUUsR0FBRyxJQUFJLENBQUMsQ0FBQztJQUNsRCxPQUFPOzs7Z0JBR08sUUFBUTtzQkFDRixVQUFV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