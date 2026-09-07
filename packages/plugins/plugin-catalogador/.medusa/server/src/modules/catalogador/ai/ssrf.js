"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SsrfError = void 0;
exports.assertSafeUrl = assertSafeUrl;
exports.safeFetchText = safeFetchText;
const promises_1 = __importDefault(require("node:dns/promises"));
const node_net_1 = __importDefault(require("node:net"));
/**
 * Endurecimiento anti-SSRF para el scraping (PRD §32). Toda URL externa pasa por
 * acá antes de fetchear: sólo http/https, host resuelto a IP pública (se
 * rechazan loopback/privadas/link-local/metadata), y contra allow/block-list de
 * dominios. Sin esto, un contenido malicioso podría hacernos pegar a la red
 * interna o a 169.254.169.254 (metadata del cloud).
 */
class SsrfError extends Error {
}
exports.SsrfError = SsrfError;
function ipIsPrivate(ip) {
    if (node_net_1.default.isIPv4(ip)) {
        const octets = ip.split('.').map(Number);
        const a = octets[0] ?? 0;
        const b = octets[1] ?? 0;
        if (a === 10)
            return true;
        if (a === 127)
            return true;
        if (a === 0)
            return true;
        if (a === 169 && b === 254)
            return true; // link-local + metadata
        if (a === 172 && b >= 16 && b <= 31)
            return true;
        if (a === 192 && b === 168)
            return true;
        if (a === 100 && b >= 64 && b <= 127)
            return true; // CGNAT
        return false;
    }
    if (node_net_1.default.isIPv6(ip)) {
        const v = ip.toLowerCase();
        if (v === '::1' || v === '::')
            return true;
        if (v.startsWith('fe80') || v.startsWith('fc') || v.startsWith('fd'))
            return true;
        if (v.startsWith('::ffff:'))
            return ipIsPrivate(v.slice(7)); // IPv4-mapped
        return false;
    }
    return true; // desconocido = inseguro
}
function hostAllowed(host, allow, block) {
    const h = host.toLowerCase();
    const matches = (d) => h === d.toLowerCase() || h.endsWith(`.${d.toLowerCase()}`);
    if (block.some(matches))
        return false;
    if (allow.length === 0)
        return false; // sin allowlist explícita, no se scrapea
    return allow.some(matches);
}
/** Valida esquema, allow/block-list y que TODAS las IPs resueltas sean públicas. */
async function assertSafeUrl(raw, opts) {
    let url;
    try {
        url = new URL(raw);
    }
    catch {
        throw new SsrfError(`URL inválida: ${raw}`);
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new SsrfError(`Esquema no permitido: ${url.protocol}`);
    }
    if (!hostAllowed(url.hostname, opts.allowedDomains, opts.blockedDomains)) {
        throw new SsrfError(`Dominio no permitido: ${url.hostname}`);
    }
    // Si ya es una IP literal, validarla directo.
    if (node_net_1.default.isIP(url.hostname)) {
        if (ipIsPrivate(url.hostname))
            throw new SsrfError(`IP privada no permitida: ${url.hostname}`);
        return url;
    }
    const records = await promises_1.default.lookup(url.hostname, { all: true }).catch(() => []);
    if (!records.length)
        throw new SsrfError(`No se pudo resolver: ${url.hostname}`);
    for (const r of records) {
        if (ipIsPrivate(r.address)) {
            throw new SsrfError(`El host resuelve a una IP privada (${r.address}).`);
        }
    }
    return url;
}
/**
 * Fetch endurecido: valida la URL, prohíbe redirects (para no saltar a un host
 * no validado) y limita el tamaño de la respuesta.
 */
async function safeFetchText(raw, opts) {
    const url = await assertSafeUrl(raw, opts);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
    try {
        const res = await fetch(url, {
            redirect: 'error', // un redirect podría apuntar a un host no validado
            signal: controller.signal,
            headers: { 'User-Agent': opts.userAgent, Accept: 'text/html,application/xhtml+xml' },
        });
        if (!res.ok)
            throw new SsrfError(`HTTP ${res.status} en ${url.hostname}`);
        const maxBytes = opts.maxBytes ?? 1_500_000;
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > maxBytes)
            return buf.subarray(0, maxBytes).toString('utf8');
        return buf.toString('utf8');
    }
    finally {
        clearTimeout(timer);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3NyZi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL2NhdGFsb2dhZG9yL2FpL3NzcmYudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBNkNBLHNDQTZCQztBQU1ELHNDQXFCQztBQXJHRCxpRUFBb0M7QUFDcEMsd0RBQTJCO0FBRTNCOzs7Ozs7R0FNRztBQUNILE1BQWEsU0FBVSxTQUFRLEtBQUs7Q0FBRztBQUF2Qyw4QkFBdUM7QUFFdkMsU0FBUyxXQUFXLENBQUMsRUFBVTtJQUM3QixJQUFJLGtCQUFHLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUM7UUFDbkIsTUFBTSxNQUFNLEdBQUcsRUFBRSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDekMsTUFBTSxDQUFDLEdBQUcsTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN6QixNQUFNLENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3pCLElBQUksQ0FBQyxLQUFLLEVBQUU7WUFBRSxPQUFPLElBQUksQ0FBQztRQUMxQixJQUFJLENBQUMsS0FBSyxHQUFHO1lBQUUsT0FBTyxJQUFJLENBQUM7UUFDM0IsSUFBSSxDQUFDLEtBQUssQ0FBQztZQUFFLE9BQU8sSUFBSSxDQUFDO1FBQ3pCLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLEtBQUssR0FBRztZQUFFLE9BQU8sSUFBSSxDQUFDLENBQUMsd0JBQXdCO1FBQ2pFLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSSxFQUFFO1lBQUUsT0FBTyxJQUFJLENBQUM7UUFDakQsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsS0FBSyxHQUFHO1lBQUUsT0FBTyxJQUFJLENBQUM7UUFDeEMsSUFB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