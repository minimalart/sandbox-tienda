import { type ArcaConfig } from './config';
import { type ArcaCache, type WsaaTicket } from './types';
export declare function buildTra(service: string, now: Date): string;
/** Firma el TRA como CMS/PKCS#7 attached (SHA-256) y lo devuelve en base64. */
export declare function signTraCms(tra: string, certPem: string, keyPem: string): string;
export declare function buildLoginCmsEnvelope(cmsBase64: string): string;
/** Extrae el faultstring de un envelope SOAP, o null si no hay fault. */
export declare function extractSoapFault(xml: string): string | null;
/**
 * Parsea la respuesta de loginCms: el envelope trae loginTicketResponse como
 * string XML escapado dentro de loginCmsReturn (el parser decodifica entidades).
 */
export declare function parseLoginTicketResponse(soapXml: string): WsaaTicket;
export declare function getWsaaTicket(opts: {
    cache: ArcaCache;
    fetchImpl?: typeof globalThis.fetch;
    /**
     * La config de LA TIENDA. Sin esto se usa la de la INSTANCIA, que es lo correcto
     * sólo para los call sites que no tienen contenedor: ver el cartel de `config.ts`.
     */
    config?: ArcaConfig;
}): Promise<WsaaTicket>;
