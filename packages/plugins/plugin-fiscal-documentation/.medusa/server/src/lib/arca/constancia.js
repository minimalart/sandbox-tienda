"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildGetPersonaEnvelope = buildGetPersonaEnvelope;
exports.parsePersonaResponse = parsePersonaResponse;
exports.callGetPersona = callGetPersona;
const fast_xml_parser_1 = require("fast-xml-parser");
const wsaa_1 = require("./wsaa");
const types_1 = require("./types");
/**
 * ws_sr_constancia_inscripcion (personaServiceA5) — getPersona_v2.
 * La respuesta SOAP cruda NUNCA sale de este módulo ni se loguea.
 */
const REQUEST_TIMEOUT_MS = 8_000;
// `impuesto` puede venir como objeto único o array según el contribuyente.
const parser = new fast_xml_parser_1.XMLParser({
    ignoreAttributes: true,
    removeNSPrefix: true,
    parseTagValue: false,
    trimValues: true,
    isArray: (name) => name === 'impuesto',
});
function escapeXml(value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
function buildGetPersonaEnvelope(params) {
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
function parsePersonaResponse(soapXml) {
    const fault = (0, wsaa_1.extractSoapFault)(soapXml);
    if (fault) {
        if (/no existe persona/i.test(fault))
            throw new types_1.ArcaNotFoundError();
        throw new types_1.ArcaUnavailableError();
    }
    let personaReturn;
    try {
        const parsed = parser.parse(soapXml);
        const responseBody = parsed?.Envelope?.Body;
        personaReturn =
            responseBody?.getPersona_v2Response?.personaReturn ??
                responseBody?.getPersonaResponse?.personaReturn;
    }
    catch {
        personaReturn = undefined;
    }
    if (!personaReturn) {
        throw new types_1.ArcaUnavailableError('ARCA devolvió una respuesta que no se pudo interpretar.');
    }
    const constanciaErrors = personaReturn.errorConstancia?.error;
    if (constanciaErrors) {
        const messages = Array.isArray(constanciaErrors) ? constanciaErrors : [constanciaErrors];
        if (messages.some((m) => /no existe persona/i.test(String(m))))
            throw new types_1.ArcaNotFoundError();
        throw new types_1.ArcaUnavailableError();
    }
    return personaReturn;
}
async function callGetPersona(opts) {
    const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response;
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
    }
    catch {
        throw new types_1.ArcaUnavailableError();
    }
    finally {
        clearTimeout(timer);
    }
    const body = await response.text().catch(() => '');
    // Los faults llegan con HTTP 500: parsePersonaResponse los interpreta.
    if (!body)
        throw new types_1.ArcaUnavailableError();
    return parsePersonaResponse(body);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uc3RhbmNpYS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9saWIvYXJjYS9jb25zdGFuY2lhLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBaURBLDBEQWlCQztBQUdELG9EQWlDQztBQUVELHdDQWdDQztBQXhJRCxxREFBNEM7QUFDNUMsaUNBQTBDO0FBQzFDLG1DQUFtRjtBQUVuRjs7O0dBR0c7QUFFSCxNQUFNLGtCQUFrQixHQUFHLEtBQUssQ0FBQztBQXVCakMsMkVBQTJFO0FBQzNFLE1BQU0sTUFBTSxHQUFHLElBQUksMkJBQVMsQ0FBQztJQUMzQixnQkFBZ0IsRUFBRSxJQUFJO0lBQ3RCLGNBQWMsRUFBRSxJQUFJO0lBQ3BCLGFBQWEsRUFBRSxLQUFLO0lBQ3BCLFVBQVUsRUFBRSxJQUFJO0lBQ2hCLE9BQU8sRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsSUFBSSxLQUFLLFVBQVU7Q0FDdkMsQ0FBQyxDQUFDO0FBRUgsU0FBUyxTQUFTLENBQUMsS0FBYTtJQUM5QixPQUFPLEtBQUs7U0FDVCxPQUFPLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQztTQUN0QixPQUFPLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQztTQUNyQixPQUFPLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQztTQUNyQixPQUFPLENBQUMsSUFBSSxFQUFFLFFBQVEsQ0FBQyxDQUFDO0FBQzdCLENBQUM7QUFFRCxTQUFnQix1QkFBdUIsQ0FBQyxNQUt2QztJQUNDLE9BQU87Ozs7ZUFJTSxTQUFTLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQztjQUN4QixTQUFTLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQzswQkFDVixNQUFNLENBQUMsZ0JBQWdCO21CQUM5QixNQUFNLENBQUMsU0FBUzs7O29CQUdmLENBQUM7QUFDckIsQ0FBQztBQUVELHdFQUF3RTtBQUN4RSxTQUFnQixvQkFBb0IsQ0FBQyxPQUFlO0lBQ2xELE1BQU0sS0FB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