import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { AI_ASSISTANT_MODULE } from '../../../../modules/ai-assistant';
import {
  baseUrl,
  generateOpaque,
  CODE_TTL_SEC,
} from '../../../../modules/ai-assistant/oauth';

type AiService = any;

type AuthzParams = {
  client_id: string;
  redirect_uri: string;
  response_type: string;
  scope: string;
  state: string;
  code_challenge: string;
  code_challenge_method: string;
};

function esc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Marca de ESTA instalación para la pantalla de conexión del MCP: la sirve el propio
 * backend, que es el mismo origen del que se carga esta página.
 *
 * ⚠ Antes eran `${STOREFRONT_URL}/logos-mercatto/logo-verde.svg`, con el dominio de
 * Mercatto como default. O sea que el conector de IA de cualquier cliente mostraba el
 * isotipo verde de Mercatto, en la tab del navegador y arriba del formulario donde el
 * admin pone su contraseña. Se ve bien, así que nadie lo reporta.
 *
 * Son constantes y no valores leídos porque `loginPage()` es SÍNCRONA y leer la marca
 * es async. La prioridad (logotipo -> isotipo -> generado) la deciden esas rutas.
 *
 * El `<link rel="icon">` va SIN `type`: la ruta redirige a lo que haya cargado la
 * marca —png, webp o svg—, y declarar un tipo que no es hace que el ícono no cargue.
 */
const INSTANCE_LOGO = '/instance-logo';
const INSTANCE_FAVICON = '/favicon.ico';

function loginPage(p: AuthzParams, error?: string): string {
  const hidden = (Object.keys(p) as (keyof AuthzParams)[])
    .map((k) => `<input type="hidden" name="${k}" value="${esc(p[k])}" />`)
    .join('\n');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Conectar asistente — login</title>
<link rel="icon" href="${INSTANCE_FAVICON}" />
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f3f4f6;margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center}
  .card{background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:28px;width:100%;max-width:380px;box-shadow:0 10px 30px rgba(0,0,0,.06)}
  .logo{display:block;height:40px;margin:0 auto 18px}
  h1{font-size:18px;margin:0 0 4px}p{color:#6b7280;font-size:13px;margin:0 0 18px}
  label{display:block;font-size:13px;color:#374151;margin:12px 0 6px}
  input[type=email],input[type=password]{width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px}
  button{margin-top:18px;width:100%;padding:11px;background:#2e7d32;color:#fff;border:0;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer}
  .err{background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;font-size:13px;padding:8px 10px;border-radius:8px;margin-bottom:12px}
</style></head><body>
<form class="card" method="post" action="${baseUrl()}/mcp/oauth/authorize">
  <img class="logo" src="${INSTANCE_LOGO}" alt="" />
  <h1>Conectar asistente IA</h1>
  <p>Iniciá sesión con tu usuario administrador para autorizar el acceso al MCP de la tienda.</p>
  ${error ? `<div class="err">${esc(error)}</div>` : ''}
  <label>Email</label>
  <input type="email" name="email" autocomplete="username" required />
  <label>Contraseña</label>
  <input type="password" name="password" autocomplete="current-password" required />
  ${hidden}
  <button type="submit">Autorizar</button>
</form></body></html>`;
}

function readParams(src: Record<string, unknown>): AuthzParams {
  const g = (k: string) => (typeof src[k] === 'string' ? (src[k] as string) : '');
  return {
    client_id: g('client_id'),
    redirect_uri: g('redirect_uri'),
    response_type: g('response_type') || 'code',
    scope: g('scope') || 'mcp',
    state: g('state'),
    code_challenge: g('code_challenge'),
    code_challenge_method: g('code_challenge_method') || 'S256',
  };
}

async function validateClient(service: AiService, p: AuthzParams) {
  if (!p.client_id || !p.redirect_uri) return 'Faltan client_id o redirect_uri.';
  const client = await service.retrieveOAuthClient(p.client_id).catch(() => null);
  if (!client) return 'client_id desconocido.';
  const uris: string[] = Array.isArray(client.redirect_uris) ? client.redirect_uris : [];
  if (!uris.includes(p.redirect_uri)) return 'redirect_uri no registrada para este cliente.';
  return null;
}

/** GET — muestra el formulario de login (tras validar cliente y PKCE). */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const service: AiService = req.scope.resolve(AI_ASSISTANT_MODULE);
  const p = readParams(req.query as Record<string, unknown>);

  const clientErr = await validateClient(service, p);
  if (clientErr) {
    res.status(400).setHeader('Content-Type', 'text/html');
    res.send(`<p>${esc(clientErr)}</p>`);
    return;
  }
  if (p.response_type !== 'code' || !p.code_challenge || p.code_challenge_method !== 'S256') {
    redirectError(res, p, 'invalid_request');
    return;
  }

  res.setHeader('Content-Type', 'text/html');
  res.send(loginPage(p));
};

/** POST — verifica credenciales admin (loopback a /auth/user/emailpass) y emite el code. */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const service: AiService = req.scope.resolve(AI_ASSISTANT_MODULE);
  const body = (req.body ?? {}) as Record<string, any>;
  const p = readParams(body);

  const clientErr = await validateClient(service, p);
  if (clientErr) {
    res.status(400).setHeader('Content-Type', 'text/html');
    res.send(`<p>${esc(clientErr)}</p>`);
    return;
  }

  const email = typeof body.email === 'string' ? body.email : '';
  const password = typeof body.password === 'string' ? body.password : '';

  const adminId = await verifyAdmin(email, password);
  if (!adminId) {
    res.status(401).setHeader('Content-Type', 'text/html');
    res.send(loginPage(p, 'Credenciales inválidas o el usuario no es administrador.'));
    return;
  }

  const code = generateOpaque('oac_');
  await service.createOAuthCodes({
    code_hash: code.hash,
    client_id: p.client_id,
    redirect_uri: p.redirect_uri,
    scope: p.scope,
    code_challenge: p.code_challenge,
    admin_id: adminId,
    expires_at: new Date(Date.now() + CODE_TTL_SEC * 1000),
    used: false,
  });

  const url = new URL(p.redirect_uri);
  url.searchParams.set('code', code.token);
  if (p.state) url.searchParams.set('state', p.state);
  res.redirect(url.toString());
};

function redirectError(res: MedusaResponse, p: AuthzParams, error: string) {
  try {
    const url = new URL(p.redirect_uri);
    url.searchParams.set('error', error);
    if (p.state) url.searchParams.set('state', p.state);
    res.redirect(url.toString());
  } catch {
    res.status(400).json({ error });
  }
}

/**
 * Verifica credenciales de ADMIN reusando el login propio de Medusa
 * (`POST /auth/user/emailpass`, actor_type=user → rechaza customers). Devuelve
 * el id del admin (actor_id del token) o null.
 */
async function verifyAdmin(email: string, password: string): Promise<string | null> {
  if (!email || !password) return null;
  try {
    const resp = await fetch(`${baseUrl()}/auth/user/emailpass`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!resp.ok) return null;
    const data = (await resp.json().catch(() => null)) as { token?: string } | null;
    const token = data?.token;
    if (!token) return null;
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1] ?? '', 'base64').toString('utf8'),
    ) as { actor_id?: string; actor_type?: string };
    if (payload.actor_type && payload.actor_type !== 'user') return null;
    return payload.actor_id ?? null;
  } catch {
    return null;
  }
}
