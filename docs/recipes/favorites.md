# Favoritos (wishlist) en el storefront — Comportamiento documentado

> **Ticket:** MINIM-124 — Implementar favoritos de productos en el storefront
> **Medusa:** 2.15.5 (`@medusajs/framework` / `@medusajs/medusa`)
> **Estado:** Funcionalidad **ya implementada** en `develop`. Este documento describe el comportamiento real del sistema (no es una guía a futuro), con foco en la diferencia entre usuario **anónimo** y **logueado** — el criterio de aceptación que faltaba dejar por escrito.

## 1. Objetivo

Favoritos permite que un cliente marque productos con un corazón y los recupere durante su navegación. El sistema funciona **siempre**, esté logueado o no, y unifica ambos mundos cuando el usuario inicia sesión.

La decisión de persistencia del ticket ("cuenta de usuario **o** sesión/local storage") se resolvió con las **dos**: el storefront usa una estrategia **dual con sincronización**. Esa es la pieza central de este documento.

## 2. Arquitectura — qué existe y dónde vive

### Backend (módulo Medusa v2 custom)

| Pieza | Ruta |
|---|---|
| Módulo `wishlist` (modelos + service) | `apps/backend/src/modules/wishlist/` |
| Modelos `wishlist` / `wishlist-item` | `apps/backend/src/modules/wishlist/models/` |
| Migraciones | `apps/backend/src/modules/wishlist/migrations/` |
| Rutas store (de la cuenta del cliente) | `apps/backend/src/api/store/customers/me/wishlist/` |

La wishlist del usuario logueado se persiste en **base de datos**, atada al customer, vía las rutas `/store/customers/me/wishlist`.

### Storefront (Next.js 15 · App Router · Zustand)

| Pieza | Ruta | Rol |
|---|---|---|
| Store Zustand | `apps/storefront/src/lib/stores/wishlist.store.ts` | Cerebro: estado, toggle, fetch, sync |
| Hook | `apps/storefront/src/lib/hooks/use-wishlist.ts` | API pública para componentes |
| Utilidades de cookie | `apps/storefront/src/lib/util/wishlist.ts` | Lectura/escritura de la cookie guest, dedupe, detección de auth |
| Botón (corazón) | `apps/storefront/src/modules/common/components/wishlist-button/index.tsx` | UI reusable, hydration-safe |
| BFF / proxy a Medusa | `apps/storefront/src/app/api/store/wishlist/route.ts` | Route handler que habla con el backend usando el JWT |
| Página de favoritos | `apps/storefront/src/app/[countryCode]/(main)/account/@dashboard/wishlist/page.tsx` | Vista dedicada |
| Drawer | `apps/storefront/src/modules/layout/components/wishlist-drawer/index.tsx` | Acceso rápido desde el layout |
| Test e2e | `apps/storefront/tests/e2e/wishlist.spec.ts` | Cobertura del flujo |

El botón está montado tanto en las **cards** (listado/grid, home) como en el **template de PDP** (`apps/storefront/src/modules/products/templates/index.tsx`), así que el estado de favorito se refleja en ambos lugares.

## 3. La decisión clave: ¿cómo sé si el usuario está logueado?

No hay una llamada al servidor para decidir la estrategia. El store mira la cookie de sesión de Medusa **del lado del cliente**:

```ts
// lib/util/wishlist.ts
export function isWishlistAuthenticated(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.includes("_medusa_jwt=");
}
```

- Hay `_medusa_jwt` → **logueado** → persistencia en backend.
- No hay `_medusa_jwt` → **anónimo** → persistencia en cookie local.

> ⚠️ Por eso `isWishlistAuthenticated()` solo es confiable en el cliente. En SSR siempre devuelve `false`; el botón se renderiza neutro y se corrige al montar (ver §7, hydration).

## 4. Comportamiento del usuario ANÓNIMO

Todo ocurre en el navegador, sin tocar el backend.

| Aspecto | Detalle |
|---|---|
| Dónde se guarda | Cookie `_wishlist_guest` (constante `GUEST_WISHLIST_COOKIE`) |
| Formato | JSON: array de `{ product_id, product_variant_id, quantity }` |
| Duración | 30 días (`max-age = 60*60*24*30`), `path=/`, `samesite=lax` |
| Identidad del item | `id` sintético `guest_<product_id>:<variant_id>` |
| Dedupe | Por clave `product_id:variant_id` al leer y escribir |

```
┌─ ANÓNIMO — toggle de un producto ──────────────────────────┐
│ 1. Click en el corazón → toggleItem(productId, variantId)   │
│ 2. isWishlistAuthenticated() === false                      │
│ 3. Se recalcula la lista (agrega o quita el item)           │
│ 4. writeGuestWishlistCookie(...) → persiste en _wishlist_guest │
│ 5. set({ items }) → la UI se actualiza al instante          │
│    (sin debounce, sin red, sin backend)                     │
└─────────────────────────────────────────────────────────────┘
```

Al cargar la página, `fetchWishlist()` lee la cookie guest y la vuelca al estado. No hay request al backend mientras el usuario sea anónimo.

## 5. Comportamiento del usuario LOGUEADO

La fuente de verdad es el **backend**, con escritura optimista y un colchón de resiliencia.

| Aspecto | Detalle |
|---|---|
| Dónde se guarda | Base de datos, vía `/api/store/wishlist` → `/store/customers/me/wishlist` |
| Autenticación | El route handler lee `_medusa_jwt` y lo manda como `Bearer` al backend |
| UX | **Optimista**: la UI cambia ya; la red va detrás |
| Debounce | 500 ms por item (`DEBOUNCE_MS`) para no spamear la API en clicks repetidos |
| Estado intermedio | `pendingToggles` marca los items "en vuelo" (`isToggling`) |

```
┌─ LOGUEADO — toggle de un producto ─────────────────────────┐
│ 1. Click → toggleItem(...)                                  │
│ 2. isWishlistAuthenticated() === true                       │
│ 3. Update OPTIMISTA del estado (item con id optimistic_*)   │
│ 4. Se arma un timer con debounce de 500 ms                  │
│ 5. Al disparar: POST /api/store/wishlist { action }         │
│      add → reemplaza el item optimista por el real del back │
│      remove → confirma la baja                              │
│ 6. Si la API falla (token vencido, red, dev sin backend):   │
│      se MANTIENE el estado optimista y se persiste como     │
│      guest (writeGuestWishlistCookie) → nunca se pierde     │
└─────────────────────────────────────────────────────────────┘
```

> 🔑 El fallback a cookie guest ante fallo de API es deliberado: garantiza que favoritos "funcione" aun con backend caído o token expirado en desarrollo. La contracara es que, en ese escenario degradado, un favorito de un usuario logueado puede terminar viviendo temporalmente en la cookie guest hasta el próximo sync.

## 6. El puente entre ambos mundos: login y logout

Acá se resuelve "qué pasa con lo que marqué sin loguearme".

### Al iniciar sesión → `syncGuestWishlist()`

Disparado desde `apps/storefront/src/lib/hooks/use-auth.ts` (tras un login exitoso).

```
┌─ SYNC al loguearse ────────────────────────────────────────┐
│ 1. Lee y dedupea la cookie guest                            │
│ 2. Si está vacía → reset + fetch del backend y listo        │
│ 3. Trae la wishlist remota (GET)                            │
│ 4. Calcula los guest items que NO están ya en el backend    │
│ 5. Los sube uno por uno (POST add)                          │
│ 6. CONFIRMA que se persistieron (hasta 3 reintentos, 250 ms)│
│ 7. Si confirma → borra la cookie guest                      │
│ 8. Estado final = merge(remoto, guest) sin duplicados       │
└─────────────────────────────────────────────────────────────┘
```

Reglas del merge (`mergeWishlistItems`): el item **remoto gana** sobre el guest ante la misma clave `product_id:variant_id`; los guest que no existían se agregan. La cookie guest **solo se borra si la confirmación fue exitosa**, así no se pierde nada si el sync falla a mitad.

> El sync está guardado contra ejecuciones en paralelo con un `guestWishlistSyncPromise` a nivel módulo (un solo sync a la vez).

### Al cerrar sesión → `reset()`

`use-auth.ts` llama `useWishlistStore.getState().reset()`: limpia el estado en memoria y los timers. A partir de ahí el store vuelve a operar en modo anónimo (cookie guest).

## 7. Detalles finos y gotchas

1. **Hydration-safe.** `WishlistButton` arranca "apagado" en SSR y recién refleja el estado real tras montar (`mounted` flag). Es para evitar mismatch de hidratación, porque el estado real solo se conoce en el cliente (la cookie no se lee en server). Lo notás como un parpadeo mínimo del corazón en el primer render.
2. **`quantity` por defecto = 1.** El modelo soporta cantidad, pero el toggle siempre usa 1. Hoy favoritos es booleano (está / no está), no un "guardar N".
3. **Clave de identidad = `product_id:variant_id`.** Un producto con varias variantes puede aparecer más de una vez en favoritos (una por variante). Tenerlo en cuenta para conteos y UI.
4. **Sin backend en dev.** Gracias al fallback de §5, el corazón sigue funcionando contra la cookie aunque no levantes el backend.
5. **`_medusa_jwt` como heurística de auth.** Es una verificación de presencia de cookie, no una validación del token. Un token expirado se detecta recién cuando la API responde error (y ahí entra el fallback).

## 8. Mapa contra los criterios de aceptación del ticket

| Criterio | Cómo se cumple |
|---|---|
| Marcar/desmarcar favoritos | `WishlistButton` → `toggleItem()` |
| Estado reflejado en cards y PDP | Botón montado en cards (grid/home) y en `products/templates/index.tsx` (PDP) |
| Persiste por cuenta **o** sesión | Dual: backend si logueado, cookie `_wishlist_guest` si anónimo |
| Forma de ver/acceder a favoritos | Página `account/.../wishlist` + `wishlist-drawer` |
| Documentado anónimo vs logueado | **Este documento** (§3–§6) |

## 9. Conclusión

Favoritos está implementado y cubre los cinco criterios del ticket. La definición de persistencia que quedaba abierta se resolvió con un modelo **dual con sincronización al login**: el anónimo guarda en cookie local (30 días), el logueado en backend con UX optimista, y al iniciar sesión se hace merge subiendo lo del invitado sin duplicar. Este documento deja por escrito ese comportamiento, que era el último criterio de aceptación pendiente.
