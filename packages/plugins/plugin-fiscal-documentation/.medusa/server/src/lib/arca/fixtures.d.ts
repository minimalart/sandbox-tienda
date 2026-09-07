/**
 * Fixtures XML para tests del módulo ARCA (constantes/funciones string para
 * no depender de fs ni de paths post-build). Shapes tomados de respuestas
 * reales de WSAA y personaServiceA5 (datos ficticios).
 */
/** Respuesta de loginCms: loginTicketResponse viene XML-escapado adentro. */
export declare function wsaaLoginResponse(opts: {
    token?: string;
    sign?: string;
    expirationIso: string;
}): string;
export declare const WSAA_FAULT_TA_VALIDO = "<soapenv:Envelope xmlns:soapenv=\"http://schemas.xmlsoap.org/soap/envelope/\">\n  <soapenv:Body>\n    <soapenv:Fault>\n      <faultcode>ns1:coms.alreadyAuthenticated</faultcode>\n      <faultstring>El CEE ya posee un TA valido para el acceso al WSN solicitado</faultstring>\n    </soapenv:Fault>\n  </soapenv:Body>\n</soapenv:Envelope>";
export declare const WSAA_FAULT_GENERICO = "<soapenv:Envelope xmlns:soapenv=\"http://schemas.xmlsoap.org/soap/envelope/\">\n  <soapenv:Body>\n    <soapenv:Fault>\n      <faultcode>ns1:cms.bad</faultcode>\n      <faultstring>Error de firma CMS</faultstring>\n    </soapenv:Fault>\n  </soapenv:Body>\n</soapenv:Envelope>";
/** Sociedad responsable inscripto (impuesto 30 + otros), con localidad. */
export declare const PERSONA_RI: string;
/** Exento: UN solo <impuesto> (objeto, no array) con id 32. Sin localidad (CABA). */
export declare const PERSONA_EXENTA_CABA: string;
/** Persona física monotributista (sin razonSocial, sin codPostal). */
export declare const PERSONA_MONOTRIBUTO: string;
export declare const PERSONA_FAULT_NO_EXISTE = "<soap:Envelope xmlns:soap=\"http://schemas.xmlsoap.org/soap/envelope/\">\n  <soap:Body>\n    <soap:Fault>\n      <faultcode>soap:Server</faultcode>\n      <faultstring>No existe persona con ese Id</faultstring>\n    </soap:Fault>\n  </soap:Body>\n</soap:Envelope>";
export declare const PERSONA_ERROR_CONSTANCIA: string;
