# Tiendas por subdominio — runbook de ops

Todo el código de resolución por host ya está mergeado y **apagado**. Se prende con una
variable de entorno. Este documento es lo que hay que hacer del lado de ops, en orden.

## 0. La decisión que falta: dónde delegar el NS

Para que Vercel emita el **certificado wildcard** hace falta el DNS challenge, y eso
exige delegarle los nameservers de la zona. Hay dos caminos, y **el código es idéntico
en los dos** (el lookup es un suffix match, agnóstico a la cantidad de labels):

| | Canónico | DNS | Riesgo |
|---|---|---|---|
| **A — apex** | `moda.ejemplo.com` | NS del apex a Vercel = **migrar la zona completa** | MX/SPF/DKIM/DMARC; se pierde el WAF del proveedor actual; rollback sujeto a propagación (24-48 h) |
| **B — subdominio** | `moda.sites.ejemplo.com` | **un** registro NS de `sites`, apex intacto | sólo URL más larga |

**Recomendado: B primero, A como follow-up con dueño de infra y runbook propio.** B no
cierra A: migrar después es cambiar `NEXT_PUBLIC_SITE_HOST_SUFFIX` y 308ear los hosts
viejos.

**Antes de decidir, correr esto** — el dominio de ejemplo del PRD no aparece en ningún
archivo del repo, y el correo puede estar en otra zona:

```bash
dig +short NS  ejemplo.com     # ¿quién tiene la zona hoy?
dig +short MX  ejemplo.com     # ¿hay correo en juego?
dig +short TXT ejemplo.com     # SPF y verificaciones
dig +short TXT _dmarc.ejemplo.com
```

Si la zona **ya está en Vercel DNS**, A es gratis y la elección se cae sola.

⚠ **Si se elige A**: delegar el NS del apex mueve la **zona entera**. Hay que
inventariar todos los registros (MX, SPF, DKIM `selector._domainkey`, DMARC `_dmarc`,
TXT de verificación) y **recrearlos en Vercel DNS ANTES** de cambiar el NS en el
registrar. Un MX olvidado no rebota: el correo simplemente deja de llegar. Bajar los
TTL a 60s el día anterior.

## 1. DNS + certificado

Opción B (un solo registro en el DNS actual):

```
sites  NS  ns1.vercel-dns.com
sites  NS  ns2.vercel-dns.com
```

Después, en el proyecto de Vercel: agregar `sites.ejemplo.com` y luego
`*.sites.ejemplo.com`, y verificar que el certificado wildcard se emita.

⚠ **A confirmar con Vercel antes de comprometerse** (10 minutos): que emita un wildcard
sobre un subdominio delegado por NS.

⚠ `www.<slug>.<sufijo>` **no lo cubre** un wildcard de un solo label: falla en TLS antes
de llegar a nuestro código. No documentar esa vía. `resolveHostSlug()` ya rechaza los
hosts con dos labels.

## 2. CORS de Medusa — ES LO #1 QUE MUERDE EL DÍA 1

`STORE_CORS` y `AUTH_CORS` tienen que cubrir el wildcard. **Sin esto, cada llamada del
browser a `/store/*` falla por CORS y la tienda se ve rota de una forma que no tiene
nada que ver con el proxy** — se pierde media tarde buscando en el lugar equivocado.

Se leen en `apps/backend/medusa-config.ts:134-136`, pero **los valores viven en el
AppSpec de DigitalOcean, que NO está versionado en el repo** (`deploy-backend.yml:25-26`).
Se cambian en el dashboard de DO.

Aceptan regex. **Anclar y pinnear el esquema**: `/^https:\/\/([a-z0-9-]+\.)?sites\.ejemplo\.com$/`
más el apex. Un `/\.ejemplo\.com$/` sin anclar matchea también `http://` y cualquier
prefijo.

## 3. Prender el interruptor

En Vercel:

```
NEXT_PUBLIC_SITE_HOST_SUFFIX=.sites.ejemplo.com
NEXT_PUBLIC_PRIMARY_HOST=ejemplo.com
```

**Rollback = borrar `NEXT_PUBLIC_SITE_HOST_SUFFIX`.** Todo el código de host vuelve a
ser no-op y las tiendas siguen andando por `/tienda/<slug>`.

## 4. Verificación en producción

Con el wildcard vivo, crear una tienda desechable de slug `qa`:

1. `curl -sI https://qa.<sufijo>/` → 200, y el HTML con el branding correcto.
2. **La incógnita abierta del proyecto** — ¿el CDN keyea por `Host`?
   ```bash
   curl -s https://qa.<sufijo>/sitemap.xml | head
   curl -s https://<principal>/sitemap.xml | head
   ```
   Tienen que dar **contenido distinto**. Correrlo dos veces (la segunda en caliente).
   Si son idénticos, el CDN no keyea por host y **toda ruta cacheada pasa a `no-store`**.
   Ídem `/robots.txt`, `/llms.txt`, `/opengraph-image`.
3. Loguearse en el principal y abrir `qa.<sufijo>/account` → **tiene que estar
   deslogueado**. (Sale gratis: ninguna cookie del repo setea `domain`.)
4. Agregar al carrito en cada host → **dos carritos independientes**. Esto además
   arregla un bug vivo: hoy, con la forma por path, todas las tiendas comparten un
   `_medusa_cart_id` con el principal.
5. Devtools: **cero errores de CORS** en `/store/*`.
6. **Aserción negativa de seguridad**:
   ```bash
   curl -H 'x-forwarded-host: qa.<sufijo>' https://<principal>/
   ```
   Tiene que servir el **sitio principal**, no `qa`. Si sirve `qa`, el gateo por
   `VERCEL_ENV` no está funcionando y hay impersonación de tenant.

## 5. Lo que NO hay que hacer, nunca

- **Poner `domain: '.ejemplo.com'` en una cookie.** Compartiría carritos, JWTs y tokens
  de gate entre TODOS los sitios de clientes: fuga de sesión cross-tenant. Que ninguna
  cookie setee `domain` es el mecanismo primario de aislamiento, no un detalle.
- **Agregar `revalidate` > 0 o ISR a una página bajo `[countryCode]`.** Los paths de
  sub-ruta son idénticos entre hosts. Lo hace cumplir
  `lib/site-config/cache-directives.test.ts`.
- **Agregar `export const runtime` a `proxy.ts`.** Rompe el build de producción con
  `E1031` (verificado en el Next 16.2.9 instalado).
- **Renombrar el slug de una tienda ya publicada.** Bajo subdominios cambia el HOST: el
  host viejo pasa a "desconocido" y sirve **200 con el contenido del sitio principal**,
  que es peor que un 404. El backend ya rechaza cambiar el slug después de crear.
