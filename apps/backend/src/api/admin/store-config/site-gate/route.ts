import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { z } from 'zod';
import { siteFromRequest } from '../../../../lib/multistore/request';
import {
  PASSWORD_GATE_MAX_LENGTH,
  PASSWORD_GATE_MIN_LENGTH,
} from '../../../../modules/store-config/service';
import { listGateSites, saveGateSite } from '../../../../modules/store-config/site-gate';

/**
 * El `scope` de la fila que le corresponde a la tienda activa, o `null` si no hay
 * tienda elegida (capa de instancia → se ven todas).
 *
 * La tienda principal NO tiene fila `site:{slug}`: su gate vive en el setting
 * `password_gate` y `listGateSites` la emite como la fila sintética `store`
 * (`modules/store-config/site-gate.ts:135-143,164`). Sin este caso especial, elegir
 * la principal dejaría la pestaña vacía.
 */
const scopeOf = async (req: MedusaRequest): Promise<string | null> => {
  const resolution = await siteFromRequest(req);
  if (resolution.status !== 'site') return null;
  return resolution.site.is_main ? 'store' : `site:${resolution.site.slug}`;
};

/**
 * `site:` es lo que emite el backend hoy; `demo:` es el prefijo viejo que el schema
 * sigue aceptando. Se comparan normalizados para que un cliente desactualizado no se
 * coma un 403 por una diferencia de vocabulario.
 */
const sameScope = (a: string, b: string): boolean =>
  a.replace(/^demo:/, 'site:') === b.replace(/^demo:/, 'site:');

/**
 * GET /admin/store-config/site-gate — sitios que se pueden proteger con la
 * página de contraseña: la tienda principal + una fila por demo `ready`.
 *
 * FILTRA POR TIENDA. Antes devolvía siempre las tres y la pestaña "Acceso" las
 * listaba todas debajo de un badge que decía "Filtra por tienda". Sin tienda elegida
 * se siguen devolviendo todas, que es lo correcto: ahí "sin tienda" significa "la
 * instancia", y desde la instancia se administran todas.
 *
 * Devuelve la palabra en claro a propósito: es una ruta de admin autenticada y
 * el operador necesita verla para compartirla. La API pública nunca la expone.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const sites = await listGateSites(req.scope);
    const scope = await scopeOf(req);
    const visible = scope ? sites.filter((site) => sameScope(site.scope, scope)) : sites;
    return res.status(200).json({ sites: visible });
  } catch (error) {
    console.error('[Admin SiteGate] Error listando sitios:', error);
    return res.status(500).json({ message: 'Error leyendo la configuración de acceso' });
  }
}

const UpdateSiteGateSchema = z.object({
  /** `store` o `demo:{slug}`. */
  scope: z
    .string()
    .min(1)
    .regex(/^(store|(?:site|demo):[a-z0-9]+(?:-[a-z0-9]+)*)$/, 'Scope inválido'),
  enabled: z.boolean().optional(),
  password: z
    .string()
    .trim()
    .refine(
      (v) =>
        v === '' ||
        (!/\s/.test(v) &&
          v.length >= PASSWORD_GATE_MIN_LENGTH &&
          v.length <= PASSWORD_GATE_MAX_LENGTH),
      `La contraseña debe tener entre ${PASSWORD_GATE_MIN_LENGTH} y ${PASSWORD_GATE_MAX_LENGTH} caracteres, sin espacios`,
    )
    .optional(),
});

/**
 * POST /admin/store-config/site-gate — guarda el gate de UN sitio.
 * Sin palabra usable el gate queda apagado (una tienda con gate prendido y sin
 * clave sería inaccesible incluso para su dueño).
 *
 * La escritura se valida contra la MISMA tienda que filtra el GET. Filtrar sólo la
 * lectura sería media migración: la pestaña mostraría una tienda y un POST armado a
 * mano podría cambiarle la contraseña a otra. Con tienda elegida sólo se puede
 * escribir su propia fila.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const body = UpdateSiteGateSchema.parse(req.body);
    const scope = await scopeOf(req);
    if (scope && !sameScope(body.scope, scope)) {
      return res.status(403).json({
        message: `La tienda seleccionada sólo puede editar su propio acceso (${scope}).`,
      });
    }
    const site = await saveGateSite(req.scope, body);
    return res.status(200).json({ site });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error guardando el acceso';
    console.error('[Admin SiteGate] Error guardando:', message);
    return res.status(400).json({ message });
  }
}
