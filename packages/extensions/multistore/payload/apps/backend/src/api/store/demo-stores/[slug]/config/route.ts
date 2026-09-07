/**
 * ⚠ RUTA LEGACY — se conserva UN RELEASE y después se borra.
 *
 * La ruta real vive en `api/store/sites/[slug]/config`. Esta existe porque el backend
 * y el storefront se despliegan por caminos TOTALMENTE INDEPENDIENTES (el backend a
 * DigitalOcean por paths de `apps/backend/**`; el storefront por un empty-commit
 * trigger, con `paths-ignore` de esos mismos paths). No hay orden garantizado entre
 * los dos, así que hay una ventana en la que el storefront desplegado es más viejo que
 * el backend y sigue pidiendo esta URL.
 *
 * Sin este espejo, en esa ventana `getTenantBySlug()` daría 404 para TODAS las tiendas
 * y todas renderizarían con el branding por defecto del sitio principal.
 *
 * Es un re-export, no una copia: los guards (el 404 de `is_main`, el `status !== ready`)
 * viven una sola vez y no pueden driftear entre las dos rutas.
 *
 * BORRAR EN EL PR DE CLEANUP, junto con el fallback del storefront en
 * `lib/site-config/active-tenant.ts`.
 */
export { GET } from '../../../sites/[slug]/config/route';
