import { type WsaaTicket } from './types';
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
        impuesto?: Array<{
            idImpuesto?: string;
            descripcionImpuesto?: string;
            estado?: string;
        }>;
    };
    datosMonotributo?: Record<string, unknown>;
    errorConstancia?: {
        error?: string | string[];
    };
};
export declare function buildGetPersonaEnvelope(params: {
    token: string;
    sign: string;
    cuitRepresentada: string;
    idPersona: string;
}): string;
/** Parsea la respuesta SOAP de getPersona_v2 (exportado para tests). */
export declare function parsePersonaResponse(soapXml: string): PersonaReturn;
export declare function callGetPersona(opts: {
    ticket: WsaaTicket;
    cuitRepresentada: string;
    idPersona: string;
    padronUrl: string;
    fetchImpl?: typeof globalThis.fetch;
}): Promise<PersonaReturn>;
