import Medusa from '@medusajs/js-sdk';
import { siteHeader } from './active-site';

/**
 * El SDK del backoffice.
 *
 * `globalHeaders` es lo que hace que la tienda activa viaje en las 244 llamadas de
 * los 58 archivos que usan este cliente, con una línea. Los que hacen `fetch` nativo
 * van por `lib/http.ts`.
 *
 * Se resuelve UNA vez, al iniciar el módulo, y no hace falta mutarlo en runtime:
 * cambiar de tienda recarga la página (ver la nota de `active-site.ts`). Sin tienda
 * elegida devuelve `{}` y el cliente se comporta igual que antes.
 *
 * OJO: las pantallas CORE de Medusa (pedidos, productos, clientes) usan OTRA
 * instancia del SDK, la del bundle de `@medusajs/dashboard`. No pasan por acá, y a
 * propósito no se las toca: el filtro de productos del core pinta sus chips desde
 * los search params, así que inyectarle el filtro por debajo daría una tabla
 * filtrada sin un solo chip visible y con "limpiar filtros" que no restaura nada.
 */
export const sdk = new Medusa({
  baseUrl: '/',
  auth: {
    type: 'session',
  },
  globalHeaders: siteHeader(),
});
