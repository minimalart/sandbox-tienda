import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { Modules } from '@medusajs/framework/utils';
import type {
  IAuthModuleService,
  IUserModuleService,
} from '@medusajs/framework/types';
import { acceptInviteWorkflow } from '@medusajs/core-flows';

/**
 * Página propia de aceptación de invitaciones de admin (NO toca el core).
 *
 * La pantalla del core (`/app/invite`) solo sabe REGISTRAR una identidad nueva,
 * por eso falla con 401 cuando el email ya existe (p. ej. el invitado ya es
 * cliente). Acá orquestamos APIs públicas:
 *   - `authModule.register('emailpass')` si la identidad no existe;
 *   - `authModule.authenticate('emailpass')` (login) si ya existe;
 *   - y el workflow oficial `acceptInviteWorkflow` con el auth_identity_id.
 *
 * El email de invitación apunta a esta ruta (ver subscribers/invite-email.ts).
 */

function backendUrl(): string {
  const raw =
    process.env.BACKEND_URL ||
    process.env.MEDUSA_BACKEND_URL ||
    'http://localhost:9000';
  return raw.replace(/\/+$/, '');
}

/**
 * Marca de ESTA instalación, servida por el propio backend.
 *
 * Antes era `${STOREFRONT_URL}/logos-mercatto/logo-verde.svg`, con el dominio de
 * Mercatto como default. Esta página la ve el usuario que ACEPTA su invitación al
 * panel: todo cliente recibía una pantalla con la marca de otro. Y un logo ajeno que
 * carga bien no lo reporta nadie.
 *
 * Son rutas y no valores porque `page()` es SÍNCRONA y leer la marca es async; se
 * sirven del mismo origen, así que la relativa siempre resuelve. La prioridad
 * (logotipo -> isotipo -> generado) la deciden ellas, en un solo lugar.
 *
 * El `<link rel="icon">` va SIN `type`: la ruta redirige a lo que haya cargado la
 * marca —png, webp o svg—, y declarar un tipo que no es hace que el ícono no cargue.
 */
const INSTANCE_LOGO = '/instance-logo';
const INSTANCE_FAVICON = '/favicon.ico';

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

type InviteRow = {
  id: string;
  email: string;
  accepted?: boolean;
  expires_at?: string | Date | null;
} | null;

/** El token de invitación es un JWT con `{ id, email, exp }` en el payload. */
function decodeInviteToken(
  token: string,
): { id?: string; email?: string } | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const json = Buffer.from(part, 'base64').toString('utf8');
    return JSON.parse(json) as { id?: string; email?: string };
  } catch {
    return null;
  }
}

async function findInvite(
  req: MedusaRequest,
  token: string,
): Promise<InviteRow> {
  // Filtrar invites por `token` no está soportado; decodificamos el JWT para
  // obtener el id y traemos la invitación con retrieveInvite (sí soportado).
  const decoded = decodeInviteToken(token);
  if (!decoded?.id) return null;
  const userModule = req.scope.resolve<IUserModuleService>(Modules.USER);
  try {
    const invite = await userModule.retrieveInvite(decoded.id);
    return (invite as unknown as InviteRow) ?? null;
  } catch {
    return null;
  }
}

function isExpired(invite: NonNullable<InviteRow>): boolean {
  if (!invite.expires_at) return false;
  return new Date(invite.expires_at).getTime() < Date.now();
}

function page(opts: {
  title: string;
  bodyHtml: string;
}): string {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(opts.title)}</title>
<link rel="icon" href="${INSTANCE_FAVICON}" />
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f3f4f6;margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center}
  .card{background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:28px;width:100%;max-width:400px;box-shadow:0 10px 30px rgba(0,0,0,.06)}
  .logo{display:block;height:40px;margin:0 auto 18px}
  h1{font-size:18px;margin:0 0 4px;text-align:center}p.sub{color:#6b7280;font-size:13px;margin:0 0 18px;text-align:center}
  label{display:block;font-size:13px;color:#374151;margin:12px 0 6px}
  input{width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px}
  input:disabled{background:#f9fafb;color:#6b7280}
  .row{display:flex;gap:10px}
  button{margin-top:18px;width:100%;padding:11px;background:#2e7d32;color:#fff;border:0;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer}
  .err{background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;font-size:13px;padding:8px 10px;border-radius:8px;margin-bottom:12px}
  .ok{background:#f0fdf4;border:1px solid #bbf7d0;color:#166534;font-size:14px;padding:14px;border-radius:8px;text-align:center}
  a.btn{display:block;margin-top:16px;text-align:center;color:#2e7d32;font-weight:600;text-decoration:none;font-size:14px}
</style></head><body>
<div class="card">
  <img class="logo" src="${INSTANCE_LOGO}" alt="" />
  ${opts.bodyHtml}
</div></body></html>`;
}

function formBody(p: {
  token: string;
  email: string;
  first_name?: string;
  last_name?: string;
  error?: string;
}): string {
  return `
  <h1>Aceptar invitación</h1>
  <p class="sub">Creá tu acceso al panel de administración.</p>
  ${p.error ? `<div class="err">${esc(p.error)}</div>` : ''}
  <form method="post" action="${backendUrl()}/invitations/accept">
    <input type="hidden" name="token" value="${esc(p.token)}" />
    <label>Email</label>
    <input type="email" name="email" value="${esc(p.email)}" disabled />
    <div class="row">
      <div style="flex:1">
        <label>Nombre</label>
        <input type="text" name="first_name" value="${esc(p.first_name)}" autocomplete="given-name" />
      </div>
      <div style="flex:1">
        <label>Apellido</label>
        <input type="text" name="last_name" value="${esc(p.last_name)}" autocomplete="family-name" />
      </div>
    </div>
    <label>Contraseña</label>
    <input type="password" name="password" minlength="8" required autocomplete="current-password" placeholder="Tu contraseña (si ya tenés cuenta, usá esa)" />
    <button type="submit">Aceptar invitación</button>
  </form>`;
}

function readField(src: Record<string, unknown>, key: string): string {
  const v = src[key];
  return typeof v === 'string' ? v : '';
}

/** GET — muestra el formulario tras validar el token de invitación. */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const token = readField(req.query as Record<string, unknown>, 'token');
  res.setHeader('Content-Type', 'text/html');

  if (!token) {
    res.status(400).send(page({ title: 'Invitación', bodyHtml: `<div class="err">Falta el token de invitación.</div>` }));
    return;
  }
  const invite = await findInvite(req, token);
  if (!invite) {
    res.status(404).send(page({ title: 'Invitación', bodyHtml: `<div class="err">La invitación no es válida o fue revocada.</div>` }));
    return;
  }
  if (invite.accepted) {
    res.send(page({ title: 'Invitación', bodyHtml: `<div class="ok">Esta invitación ya fue aceptada.</div><a class="btn" href="${backendUrl()}/app/login">Ir al panel</a>` }));
    return;
  }
  if (isExpired(invite)) {
    res.send(page({ title: 'Invitación', bodyHtml: `<div class="err">La invitación expiró. Pedí que te la reenvíen.</div>` }));
    return;
  }

  res.send(page({ title: 'Aceptar invitación', bodyHtml: formBody({ token, email: invite.email }) }));
};

/** POST — registra o loguea la identidad y corre el workflow oficial de aceptación. */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const token = readField(body, 'token');
  const password = readField(body, 'password');
  const first_name = readField(body, 'first_name');
  const last_name = readField(body, 'last_name');

  res.setHeader('Content-Type', 'text/html');

  const invite = token ? await findInvite(req, token) : null;
  if (!invite) {
    res.status(404).send(page({ title: 'Invitación', bodyHtml: `<div class="err">La invitación no es válida o fue revocada.</div>` }));
    return;
  }
  if (invite.accepted) {
    res.send(page({ title: 'Invitación', bodyHtml: `<div class="ok">Esta invitación ya fue aceptada.</div><a class="btn" href="${backendUrl()}/app/login">Ir al panel</a>` }));
    return;
  }
  if (isExpired(invite)) {
    res.send(page({ title: 'Invitación', bodyHtml: `<div class="err">La invitación expiró. Pedí que te la reenvíen.</div>` }));
    return;
  }

  const email = invite.email;
  const renderForm = (error: string, status = 400) =>
    res.status(status).send(
      page({ title: 'Aceptar invitación', bodyHtml: formBody({ token, email, first_name, last_name, error }) }),
    );

  if (!password || password.length < 8) {
    renderForm('La contraseña debe tener al menos 8 caracteres.');
    return;
  }

  const authModule = req.scope.resolve<IAuthModuleService>(Modules.AUTH);
  const authData = {
    url: '',
    headers: {},
    query: {},
    body: { email, password },
    protocol: 'https',
  } as never;

  // 1) Resolver auth_identity_id: registrar si es nueva, loguear si ya existe.
  let authIdentityId: string | undefined;
  try {
    const reg = await authModule.register('emailpass', authData);
    if (reg.success && reg.authIdentity) {
      authIdentityId = reg.authIdentity.id;
    } else {
      const login = await authModule.authenticate('emailpass', authData);
      if (login.success && login.authIdentity) {
        authIdentityId = login.authIdentity.id;
      }
    }
  } catch {
    // cae al manejo de abajo
  }

  if (!authIdentityId) {
    renderForm(
      'No pudimos validar tus credenciales. Si ya tenías una cuenta con este email, ingresá esa misma contraseña.',
      401,
    );
    return;
  }

  // 2) Aceptar la invitación con el workflow oficial del core.
  try {
    await acceptInviteWorkflow(req.scope).run({
      input: {
        invite_token: token,
        auth_identity_id: authIdentityId,
        user: { email, first_name: first_name || undefined, last_name: last_name || undefined },
      },
    });
  } catch (e) {
    renderForm(
      `No se pudo aceptar la invitación: ${(e as Error).message || 'error inesperado'}.`,
      400,
    );
    return;
  }

  res.send(
    page({
      title: 'Listo',
      bodyHtml: `<div class="ok">¡Tu cuenta de administrador quedó lista!<br/>Ya podés ingresar al panel con tu email y contraseña.</div><a class="btn" href="${backendUrl()}/app/login">Ir al panel</a>`,
    }),
  );
};
