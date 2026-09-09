# Sesiones independientes B2B y B2C

MERCATTO-2 — cambio del 8 de septiembre de 2026.

Cada tienda y modalidad tiene una cookie de autenticación independiente. Entrar
en `/tienda/<slug>/b2b` no autentica `/tienda/<slug>`; ambas sesiones pueden estar
abiertas, incluso con clientes diferentes. Salir de una modalidad conserva la
otra. Las cuentas y permisos del backend siguen siendo los existentes: esto
separa sesiones de navegador, no crea clientes duplicados ni concede acceso B2B.

El resolver neutral `lib/util/customer-session.ts` determina modalidad y sitio.
El proxy sobrescribe los headers internos de sesión en navegación y API. Para
las API compartidas usa el contexto de la página que originó la petición; los
paths explícitos de tienda prevalecen sobre la cookie de la última tienda visitada.
`/api/b2b` siempre selecciona la modalidad B2B. Se mantienen las rutas legacy y
la resolución por host del proyecto.

Las cookies JWT son `httpOnly`, `secure` en producción y se escriben desde el
servidor. El frontend recibe sólo un marcador de presencia para favoritos; ese
marcador no autoriza ninguna API. El SDK no reutiliza tokens globales de
localStorage. Las API de cliente, direcciones, favoritos y gift cards leen la
misma sesión seleccionada que SSR y las server actions.

Los carritos y tags de caché también distinguen tienda/modalidad. La API B2B usa
los helpers comunes para escribir su carrito, y cerrar sesión elimina sólo el
carrito de esa modalidad. El login B2B no hidrata la sucursal B2C. Google mantiene
su URL de callback registrada; el contexto de origen se conserva por pestaña y
se restaura al completar el callback. No se cambiaron credenciales del proveedor.

## Aplicación del cambio

La cookie antigua `_medusa_jwt` no identifica la modalidad que la creó: se deja
de leer, sin copiarla a las dos sesiones nuevas. Al desplegar hay que iniciar
sesión nuevamente. También se dejan de reutilizar los identificadores globales
de carrito; no se borran carritos ni pedidos en la base. La sesión nueva comienza
con su propio carrito, para no adjudicar compras de otro contexto.

La entrega incluye fuente y payloads de B2B (`1.21.2`) y sucursales (`1.11.3`). El
resto del contrato de sesión vive en el núcleo y no requiere tener B2B instalado.
Aplicar el conjunto completo del cambio al actualizar un derivado: cambiar sólo
el nombre de una cookie en un login deja lectores y cierres de sesión desalineados.
No requiere migración de base. El despliegue se realiza por el flujo GitHub/Vercel del boilerplate.

## Validación

Desde `apps/storefront`:

```powershell
node --experimental-transform-types --import ./test-register.mjs --test src/lib/util/customer-session.test.ts src/lib/site-config/resolve-site.test.ts src/lib/site-config/site-path.test.ts src/lib/util/cart-customer-transfer.test.ts
node node_modules/typescript/bin/tsc --noEmit --incremental false --pretty false
```

Resultado: las 72 pruebas focalizadas y las 279 pruebas del storefront pasaron; el chequeo de tipos pasó también con instalación limpia en CI. Las pruebas cubren modalidades, tiendas diferentes, claves sin colisiones,
rechazo de JWT legacy y headers de autenticación falsificados, referrers,
contexto explícito de OAuth, logout y regresiones del resolver existente.

Una instalación Next.js temporal en `localhost:55440` ejecutó los helpers reales
de cookies, contexto y SSR con un proveedor sintético de credenciales. Pasaron
las verificaciones HTTP de login B2B con B2C anónimo, dos sesiones simultáneas,
logout en ambas direcciones, otra tienda anónima, cookies httpOnly y rechazo de
la cookie legacy. Script y resultado local: `tmp/test-session-http.cjs` y
`tmp/session-http-tests.log`.

La prueba visual no se completó: Chrome bloqueó automatización porque había otra
interfaz de extensión abierta. No se ejecutó un login real contra Google ni se
demostró la corrección en producción. La validación de release requiere además el build de Vercel de esta rama.
