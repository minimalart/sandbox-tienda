import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import {
  buildGateToken,
  passwordMatches,
  resolveGatePassword,
  tokenMatches,
} from '../../../../modules/store-config/site-gate';

/**
 * Página de contraseña — verificación pública.
 *
 * La palabra vive sólo acá: el storefront manda lo que tipeó el visitante y, si
 * acierta, recibe un token (HMAC de scope + palabra) que guarda en una cookie
 * httpOnly. En cada request revalida ese token con el GET de abajo, así que la
 * cookie no se puede fabricar a mano y cambiar la palabra corta los accesos
 * viejos.
 *
 * POST /store/store-config/site-gate  { scope, password } → { ok, token }
 * GET  /store/store-config/site-gate?scope=&token=        → { ok }
 */

/** El scope viene del cliente; se acota para no usarlo crudo en el HMAC. */
const SCOPE_RE = /^(store|(?:site|demo):[a-z0-9]+(?:-[a-z0-9]+)*)$/;

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const scope = typeof req.query.scope === 'string' ? req.query.scope : '';
  const token = typeof req.query.token === 'string' ? req.query.token : '';

  if (!SCOPE_RE.test(scope) || !token) {
    res.status(200).json({ ok: false });
    return;
  }

  try {
    const expected = await resolveGatePassword(req.scope, scope);
    // Gate apagado: no hay nada que validar y el sitio está abierto.
    if (!expected) {
      res.status(200).json({ ok: true });
      return;
    }
    res.status(200).json({ ok: tokenMatches(buildGateToken(scope, expected), token) });
  } catch (error) {
    console.error('[SiteGate] Error validando el token:', error);
    res.status(200).json({ ok: false });
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const body = (req.body ?? {}) as { scope?: unknown; password?: unknown };
  const scope = typeof body.scope === 'string' ? body.scope : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!SCOPE_RE.test(scope)) {
    res.status(400).json({ ok: false, message: 'Scope inválido' });
    return;
  }

  try {
    const expected = await resolveGatePassword(req.scope, scope);
    if (!expected) {
      // Gate apagado: no hay contraseña que validar.
      res.status(200).json({ ok: true, token: '' });
      return;
    }
    if (!passwordMatches(expected, password)) {
      res.status(401).json({ ok: false });
      return;
    }
    res.status(200).json({ ok: true, token: buildGateToken(scope, expected) });
  } catch (error) {
    console.error('[SiteGate] Error verificando la contraseña:', error);
    res.status(500).json({ ok: false });
  }
}
