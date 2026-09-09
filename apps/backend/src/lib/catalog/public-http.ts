import { lookup } from 'node:dns/promises';
import { isIP, BlockList } from 'node:net';
import { request } from 'node:https';

const blocked = new BlockList();
for (const [ip, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const)
  blocked.addSubnet(ip, prefix, 'ipv4');
export function isPublicAddress(ip: string): boolean {
  if (isIP(ip) === 4) return !blocked.check(ip, 'ipv4');
  // Require global unicast. Reject mapped IPv4, local, multicast and transition ranges.
  if (isIP(ip) !== 6 || !/^[23][0-9a-f]{3}:/i.test(ip)) return false;
  return !/^(2001:(?:0:|db8:|10:|20:)|2002:)/i.test(ip);
}
export class SourceHttpError extends Error {
  constructor(public status: number) {
    super(`La fuente respondió HTTP ${status}.`);
  }
}
export type JsonTransport = (url: string) => Promise<{ status: number; body: any }>;

/** Pin a validated DNS result to the socket; redirects are deliberately not followed. */
async function requestJson(
  urlString: string
): Promise<{ status: number; body: any; retryAfter?: string }> {
  const url = new URL(urlString);
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443'))
    throw new Error('El origen debe ser HTTPS público en el puerto estándar.');
  const addresses = await lookup(url.hostname.replace(/^\[|\]$/g, ''), { all: true });
  if (!addresses.length || addresses.some((a) => !isPublicAddress(a.address)))
    throw new Error('El origen resuelve a una red privada o reservada.');
  const pinned = addresses[0]!;
  return new Promise((resolve, reject) => {
    const req = request(
      url,
      {
        method: 'GET',
        headers: { Accept: 'application/json', 'User-Agent': 'MercattoCatalogImporter/1.0' },
        lookup: ((_host: string, options: any, callback: any) =>
          options?.all
            ? callback(null, [pinned])
            : callback(null, pinned.address, pinned.family)) as any,
      },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        res.on('data', (chunk) => {
          size += chunk.length;
          if (size > 12 * 1024 * 1024) {
            req.destroy(new Error('La respuesta supera el límite de 12 MB.'));
            return;
          }
          chunks.push(chunk);
        });
        res.on('error', reject);
        res.on('end', () => {
          clearTimeout(timer);
          const status = res.statusCode ?? 500;
          if (status < 200 || status >= 300) {
            resolve({ status, body: null, retryAfter: res.headers['retry-after'] });
            return;
          }
          try {
            resolve({ status, body: JSON.parse(Buffer.concat(chunks).toString('utf8')) });
          } catch {
            reject(new Error('La fuente no devolvió JSON válido.'));
          }
        });
      }
    );
    const timer = setTimeout(
      () => req.destroy(new Error('La fuente excedió el tiempo de espera.')),
      30000
    );
    req.on('error', () => {
      clearTimeout(timer);
      reject(new Error('No se pudo leer la fuente pública. Revisá la conexión.'));
    });
    req.end();
  });
}

export async function publicJson(
  url: string,
  transport = requestJson,
  sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
): Promise<{ status: number; body: any }> {
  for (let attempt = 0; attempt < 4; attempt++) {
    let result: Awaited<ReturnType<typeof requestJson>>;
    try {
      result = await transport(url);
    } catch (error) {
      if (attempt === 3) throw error;
      await sleep(500 * 2 ** attempt);
      continue;
    }
    if (result.status === 401 || result.status === 403) throw new SourceHttpError(result.status);
    if (result.status === 429 || result.status >= 500) {
      if (attempt === 3) throw new SourceHttpError(result.status);
      const seconds = result.retryAfter ? Number(result.retryAfter) : NaN;
      const date = result.retryAfter ? Date.parse(result.retryAfter) : NaN;
      const delay = Number.isFinite(seconds)
        ? seconds * 1000
        : Number.isFinite(date)
          ? date - Date.now()
          : 500 * 2 ** attempt;
      if (delay > 60000) throw new SourceHttpError(result.status);
      await sleep(Math.max(0, Math.min(delay, 60000)));
      continue;
    }
    if (result.status >= 300 && result.status < 400)
      throw new Error('La fuente redirige: configurá el origen HTTPS público definitivo.');
    return result;
  }
  throw new Error('No se pudo recuperar el catálogo.');
}
