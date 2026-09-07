/**
 * ⚠ RUTA LEGACY — se conserva UN RELEASE y después se borra.
 *
 * La ruta real vive en `api/store/sites/main/config`. Ver el motivo completo en
 * `../../[slug]/config/route.ts`: backend y storefront se despliegan por caminos
 * independientes, así que hay una ventana en la que el storefront desplegado pide la
 * URL vieja.
 *
 * En este caso concreto el fallback es menos crítico (si falla, el sitio principal cae
 * a `defaultConfig`, que es el comportamiento previo a la Fase 5 — inocuo), pero se
 * mantiene por simetría con la ruta por slug y para no tener dos políticas distintas.
 *
 * BORRAR EN EL PR DE CLEANUP.
 */
export { GET } from '../../../sites/main/config/route';
