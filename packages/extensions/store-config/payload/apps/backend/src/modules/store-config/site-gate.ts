import { siteStorefrontUrl } from '../../lib/multistore/public-url';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { MedusaError } from '@medusajs/framework/utils';
import { STORE_CONFIG_MODULE } from './index';
import type StoreConfigModuleService from './service';
import { normalizeGatePassword, normalizeStoredGatePassword } from './service';

/**
 * Página de contraseña (site gate) — resolución por SITIO y emisión del token.
 *
 * Un "scope" identifica al sitio protegido:
 *   - `store`        → la tienda principal (setting `password_gate`)
 *   - `site:{slug}`  → una tienda (columnas password_gate_* de `demo_store`).
 *                      Se sigue aceptando el legacy `demo:{slug}` porque el scope es
 *                      entrada del HMAC y hay tokens vivos calculados con él.
 *
 * La palabra vive sólo en el backend. Al acertarla se emite un token derivado de
 * (scope + palabra) con HMAC-SHA256, que el storefront guarda en una cookie
 * httpOnly y revalida en cada request. Así el gate no se saltea seteando una
 * cookie a mano (el problema del gate de aec-chile, que sólo miraba presencia),
 * y cambiar la palabra invalida los accesos viejos.
 */

/** El módulo demo-store es CORE, no una extensión: puede no existir. */
const DEMO_STORE_MODULE = 'demo_store';

const SECRET = process.env.JWT_SECRET || 'site-gate-dev-secret';

export type SiteGateScope = string;

export type SiteGateSite = {
  /** `store` | `site:{slug}` (legacy: `demo:{slug}`) */
  scope: SiteGateScope;
  /** Nombre para mostrar en el admin. */
  label: string;
  enabled: boolean;
  password: string;
  /** Ruta pública del sitio, para que el admin sepa dónde se aplica. */
  path: string;
  public_url?: string;
  /** Sólo para demos. */
  demo_id?: string;
};

/**
 * `site:{slug}` (o el legacy `demo:{slug}`) → slug. Cualquier otro scope → null.
 *
 * ⚠ ACEPTA LOS DOS PREFIJOS, y el legacy no se puede sacar rápido: el scope es
 * ENTRADA DEL HMAC (`buildGateToken` hashea `${scope}:${password}`), así que todo
 * token vivo en una cookie `_site_gate` fue calculado con `demo:`. Rechazar el
 * prefijo viejo dejaría a cada visitante de una tienda con contraseña afuera hasta
 * que la vuelva a tipear.
 *
 * Las cookies duran 24 h, así que el prefijo legacy se puede borrar un día después
 * de que este deploy esté en producción — no un release, un DÍA.
 */
export function siteSlugFromScope(scope: string): string | null {
  for (const prefix of ['site:', 'demo:']) {
    if (scope.startsWith(prefix)) return scope.slice(prefix.length) || null;
  }
  return null;
}

/** @deprecated Usar `siteSlugFromScope`. */
export const demoSlugFromScope = siteSlugFromScope;

/**
 * Token de acceso para un sitio. Determinístico: el storefront lo revalida
 * llamando de vuelta, sin conocer nunca la palabra.
 */
export function buildGateToken(scope: string, password: string): string {
  return createHmac('sha256', SECRET)
    .update(`${scope}:${password.toLowerCase()}`)
    .digest('hex');
}

/** Comparación de largo fijo (hex de 64 chars), sin filtrar por tiempo. */
export function tokenMatches(expected: string, received: unknown): boolean {
  if (typeof received !== 'string' || received.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(received, 'utf8'));
}

/** Comparación de la palabra: case-insensitive, en tiempo constante. */
export function passwordMatches(expected: string, received: unknown): boolean {
  if (typeof received !== 'string') return false;
  const a = Buffer.from(expected.trim().toLowerCase(), 'utf8');
  const b = Buffer.from(received.trim().toLowerCase(), 'utf8');
  if (a.length !== b.length || a.length === 0) return false;
  return timingSafeEqual(a, b);
}

/** El servicio de demo-store, o null si el módulo no está instalado. */
function resolveDemoStoreService(scope: any): any | null {
  try {
    return scope.resolve(DEMO_STORE_MODULE) ?? null;
  } catch {
    return null;
  }
}

/**
 * La palabra configurada para un scope, o '' si el sitio no tiene gate activo.
 * Es la única función que lee la palabra: cualquier respuesta HTTP se arma a
 * partir de su LARGO, nunca de su valor.
 */
export async function resolveGatePassword(
  container: any,
  scope: string,
): Promise<string> {
  const slug = siteSlugFromScope(scope);

  if (!slug) {
    if (scope !== 'store') return '';
    const service: StoreConfigModuleService = container.resolve(STORE_CONFIG_MODULE);
    const gate = await service.getPasswordGate();
    return gate.enabled ? gate.password : '';
  }

  const demoService = resolveDemoStoreService(container);
  if (!demoService) return '';
  const [demo] = await demoService.listDemoStores({ slug });
  if (!demo?.password_gate_enabled) return '';
  // Lectura sin tope de largo: bajar el máximo no puede apagar un gate ya activo
  // (eso abriría el sitio al público). Ver normalizeStoredGatePassword.
  return normalizeStoredGatePassword(demo.password_gate_password);
}

/**
 * Todos los sitios que se pueden proteger, para la pestaña "Acceso" de
 * Preferencias: la tienda principal siempre, más una fila por demo `ready`.
 * Devuelve la palabra en claro — este listado se sirve SÓLO desde /admin.
 */
export async function listGateSites(container: any): Promise<SiteGateSite[]> {
  const service: StoreConfigModuleService = container.resolve(STORE_CONFIG_MODULE);
  const storeGate = await service.getPasswordGate();

  const sites: SiteGateSite[] = [
    {
      scope: 'store',
      label: 'Tienda principal',
      enabled: storeGate.enabled,
      password: storeGate.password,
      path: '/',
    },
  ];

  const demoService = resolveDemoStoreService(container);
  if (!demoService) return sites;

  try {
    const demos = await demoService.listDemoStores(
      { status: 'ready' },
      { order: { name: 'ASC' } },
    );
    for (const demo of demos ?? []) {
      // La tienda principal YA está en la lista, como la fila sintética
      // `scope:'store'` de arriba, y su gate vive en el setting `password_gate` de
      // store_setting — no en sus columnas `password_gate_*`, que quedan en
      // NULL/false. Sin este `continue` aparecería DUPLICADA en la pestaña Acceso y
      // la segunda fila escribiría al backing store equivocado.
      //
      // Se chequea `is_main` inline y no vía `isMainStore()`: este archivo se le
      // entrega a proyectos de clientes SIN el módulo demo-store (es un
      // `managed_file` de la extensión `store-config`), así que no puede importar de
      // `modules/demo-store`. Ver `modules/module-keys.test.ts`.
      if (demo.is_main) continue;
      // Sin tope: el admin tiene que VER una palabra vieja más larga que el máximo
      // para poder acortarla (si la escondiéramos parecería que no hay ninguna).
      const password = normalizeStoredGatePassword(demo.password_gate_password);
      sites.push({
        scope: `site:${demo.slug}`,
        label: demo.name,
        enabled: Boolean(demo.password_gate_enabled) && password !== '',
        password,
        path: `/tienda/${demo.slug}`,
        public_url: siteStorefrontUrl(demo),
        demo_id: demo.id,
      });
    }
  } catch (error) {
    // Un demo-store sin tablas migradas no debe romper la pantalla: se cae al
    // listado con la tienda principal sola.
    console.error('[SiteGate] No se pudieron listar las demos:', error);
  }

  return sites;
}

/**
 * Guarda el gate de un scope. La tienda principal va al setting; una demo va a
 * sus columnas planas — NUNCA a `content_config`, que POST /admin/demo-stores/{id}
 * reemplaza entero y borraría el resto de la config del demo.
 */
export async function saveGateSite(
  container: any,
  input: { scope: string; enabled?: boolean; password?: string },
): Promise<SiteGateSite> {
  const { scope } = input;
  const slug = siteSlugFromScope(scope);

  if (!slug) {
    if (scope !== 'store') {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, `Scope desconocido: ${scope}`);
    }
    const service: StoreConfigModuleService = container.resolve(STORE_CONFIG_MODULE);
    const saved = await service.upsertPasswordGate({
      enabled: input.enabled,
      password: input.password,
    });
    return {
      scope: 'store',
      label: 'Tienda principal',
      enabled: saved.enabled,
      password: saved.password,
      path: '/',
    };
  }

  const demoService = resolveDemoStoreService(container);
  if (!demoService) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      'El módulo de demos no está instalado',
    );
  }

  const [demo] = await demoService.listDemoStores({ slug });
  if (!demo) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `No existe la tienda "${slug}"`);
  }
  // El gate de la tienda principal se guarda con `scope:'store'`, en el setting
  // `password_gate` — nunca en sus columnas planas. Escribirle acá dejaría dos
  // fuentes de verdad para el mismo gate, y la UI leería la que no se escribió.
  // (Y cambiar el scope invalidaría todas las cookies `_site_gate` vivas, porque el
  // scope es entrada del HMAC.)
  if (demo.is_main) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      'El gate de la tienda principal se guarda con scope "store", no por slug.',
    );
  }

  // Palabra NUEVA: se exige el rango completo. Palabra que ya estaba (sólo se movió
  // el switch): se conserva sin tope de largo, así prender/apagar el gate de un sitio
  // configurado antes de que el máximo bajara no borra su clave.
  const password =
    input.password !== undefined
      ? normalizeGatePassword(input.password)
      : normalizeStoredGatePassword(demo.password_gate_password);
  const enabled =
    password !== '' && (input.enabled ?? Boolean(demo.password_gate_enabled));

  await demoService.updateDemoStores({
    id: demo.id,
    password_gate_enabled: enabled,
    password_gate_password: password === '' ? null : password,
  });

  return {
    scope,
    label: demo.name,
    enabled,
    password,
    path: `/tienda/${slug}`,
    public_url: siteStorefrontUrl(demo),
    demo_id: demo.id,
  };
}
