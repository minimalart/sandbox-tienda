/**
 * Endurecimiento anti-SSRF para el scraping (PRD §32). Toda URL externa pasa por
 * acá antes de fetchear: sólo http/https, host resuelto a IP pública (se
 * rechazan loopback/privadas/link-local/metadata), y contra allow/block-list de
 * dominios. Sin esto, un contenido malicioso podría hacernos pegar a la red
 * interna o a 169.254.169.254 (metadata del cloud).
 */
export declare class SsrfError extends Error {
}
/** Valida esquema, allow/block-list y que TODAS las IPs resueltas sean públicas. */
export declare function assertSafeUrl(raw: string, opts: {
    allowedDomains: string[];
    blockedDomains: string[];
}): Promise<URL>;
/**
 * Fetch endurecido: valida la URL, prohíbe redirects (para no saltar a un host
 * no validado) y limita el tamaño de la respuesta.
 */
export declare function safeFetchText(raw: string, opts: {
    allowedDomains: string[];
    blockedDomains: string[];
    timeoutMs: number;
    userAgent: string;
    maxBytes?: number;
}): Promise<string>;
