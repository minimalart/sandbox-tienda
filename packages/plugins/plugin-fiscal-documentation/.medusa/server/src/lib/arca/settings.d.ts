import type { SiteResolution } from '../../lib/multistore/types';
import { type ArcaEnvironment } from './types';
export declare const ARCA_SETTINGS_NAMESPACE = "extension:fiscal-documentation";
/**
 * El entorno SEGURO. Es el piso cuando ninguna capa aportó valor. Homologación
 * a propósito: un default productivo emitiría comprobantes de verdad ante el
 * primer llamado que apunte a `wsfe`.
 */
export declare const SAFE_ARCA_ENVIRONMENT: ArcaEnvironment;
/** El único servicio WSAA que este módulo sabe consumir. */
export declare const DEFAULT_WSAA_SERVICE = "ws_sr_constancia_inscripcion";
export type ArcaSettings = {
    /** Sólo dígitos. Cadena vacía = ninguna capa lo aportó. */
    cuitRepresentada: string;
    environment: ArcaEnvironment;
    service: string;
    urls: {
        wsaa: string;
        padron: string;
    };
    /**
     * El par, TAL COMO SE GUARDÓ: base64 o PEM crudo. Sin normalizar a propósito —
     * la normalización (y su validación) vive en `config.ts`. Cadena vacía =
     * ninguna capa lo aportó.
     */
    certificateBase64: string;
    privateKeyBase64: string;
};
/** Conexión knex mínima que necesita el camino async. Se mantiene por compatibilidad. */
export type PgRawConnection = {
    raw: (sql: string, bindings?: unknown[]) => Promise<{
        rows?: unknown[];
    }>;
};
/**
 * Traduce lo que sea que haya en el entorno a uno de los dos entornos.
 *
 * FAIL-SAFE: cualquier cosa que no sea exactamente `production` cae en
 * homologación. Acepta `homologación` con tilde porque es como se escribe en
 * castellano.
 */
export declare function normalizeEnvironment(raw: string | undefined | null): ArcaEnvironment;
/** Instance settings for callers without a store. */
export declare function getArcaSettings(): ArcaSettings;
/** Global Minimalart account, independent of the queried company and active store. */
export declare function loadArcaSettingsViaPg(pg: PgRawConnection | undefined, _resolution?: SiteResolution): Promise<ArcaSettings>;
