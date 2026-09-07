import dns from 'node:dns/promises';
import net from 'node:net';

/**
 * Endurecimiento anti-SSRF para el scraping (PRD §32). Toda URL externa pasa por
 * acá antes de fetchear: sólo http/https, host resuelto a IP pública (se
 * rechazan loopback/privadas/link-local/metadata), y contra allow/block-list de
 * dominios. Sin esto, un contenido malicioso podría hacernos pegar a la red
 * interna o a 169.254.169.254 (metadata del cloud).
 */
export class SsrfError extends Error {}

function ipIsPrivate(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const octets = ip.split('.').map(Number);
    const a = octets[0] ?? 0;
    const b = octets[1] ?? 0;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true; // link-local + metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    return false;
  }
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    if (v === '::1' || v === '::') return true;
    if (v.startsWith('fe80') || v.startsWith('fc') || v.startsWith('fd')) return true;
    if (v.startsWith('::ffff:')) return ipIsPrivate(v.slice(7)); // IPv4-mapped
    return false;
  }
  return true; // desconocido = inseguro
}

function hostAllowed(host: string, allow: string[], block: string[]): boolean {
  const h = host.toLowerCase();
  const matches = (d: string) => h === d.toLowerCase() || h.endsWith(`.${d.toLowerCase()}`);
  if (block.some(matches)) return false;
  if (allow.length === 0) return false; // sin allowlist explícita, no se scrapea
  return allow.some(matches);
}

/** Valida esquema, allow/block-list y que TODAS las IPs resueltas sean públicas. */
export async function assertSafeUrl(
  raw: string,
  opts: { allowedDomains: string[]; blockedDomains: string[] }
): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SsrfError(`URL inválida: ${raw}`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new SsrfError(`Esquema no permitido: ${url.protocol}`);
  }
  if (!hostAllowed(url.hostname, opts.allowedDomains, opts.blockedDomains)) {
    throw new SsrfError(`Dominio no permitido: ${url.hostname}`);
  }
  // Si ya es una IP literal, validarla directo.
  if (net.isIP(url.hostname)) {
    if (ipIsPrivate(url.hostname)) throw new SsrfError(`IP privada no permitida: ${url.hostname}`);
    return url;
  }
  const records = await dns.lookup(url.hostname, { all: true }).catch(() => []);
  if (!records.length) throw new SsrfError(`No se pudo resolver: ${url.hostname}`);
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
export async function safeFetchText(
  raw: string,
  opts: { allowedDomains: string[]; blockedDomains: string[]; timeoutMs: number; userAgent: string; maxBytes?: number }
): Promise<string> {
  const url = await assertSafeUrl(raw, opts);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
  try {
    const res = await fetch(url, {
      redirect: 'error', // un redirect podría apuntar a un host no validado
      signal: controller.signal,
      headers: { 'User-Agent': opts.userAgent, Accept: 'text/html,application/xhtml+xml' },
    });
    if (!res.ok) throw new SsrfError(`HTTP ${res.status} en ${url.hostname}`);
    const maxBytes = opts.maxBytes ?? 1_500_000;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > maxBytes) return buf.subarray(0, maxBytes).toString('utf8');
    return buf.toString('utf8');
  } finally {
    clearTimeout(timer);
  }
}
