# Migrar las variables de una extensión a `app-settings`

## El problema

Para retirar variables de una instalación existente, usar la simulación y migración
explícita de [limpiar-el-env.md](./limpiar-el-env.md). No agregar seeds automáticos.
Los plugins publicados deben consumir el lector del host de
`@minimalart/mercatto-plugin-runtime`; declarar un campo en el host no conecta por
sí solo el código del paquete instalado. Los providers instalados de Mercado Pago,
Andreani y Correo ya se registran por presencia del módulo, independientemente de
sus credenciales de entorno. Revisar el código actual antes de asumir un gate de boot.

El `.env` del backend acumula ~255 variables. La mayoría no son secretos ni
infraestructura: son configuración de negocio. `correo-argentino` declara 43
—dirección de origen, dimensiones de bulto, tipo de servicio—, `andreani` ~25.
Cambiar cualquiera de esas exige editar un archivo y redeployar, cuando debería
ser un formulario en el admin.

El módulo `app-settings` mueve esa configuración a la tabla `app_setting`,
editable desde la card de cada extensión y desde el buscador central en
`/app/settings/extension-settings`.

**El env no desaparece: queda como fallback vivo, para siempre.** Existe una fila
en la tabla si y sólo si un humano sobreescribió el valor. Esa distinción es la
que alimenta la columna "Origen" del buscador, y es la que da rollback: borrás
la fila y volvés al env.

Precedencia: **fila en DB > `process.env` > `default` del descriptor**.

## Antes de empezar: el manifest miente

`packages/extensions/<id>/mercatto-component.json` declara un `environment[]`,
pero **declara de menos**. Casos medidos:

| Extensión   | Declara | Usa el código |
| ----------- | ------- | ------------- |
| `typesense` | 4       | 11            |
| `ga4`       | 2       | 6             |
| `whatsapp`  | 3       | ~25           |

Y el caso peor no está en esa tabla, porque no se ve como deriva:

| Extensión               | Declara | Usa el código |
| ----------------------- | ------- | ------------- |
| `recommendation-engine` | **0**   | 21            |

**`environment: []` no quiere decir "esta extensión no lee env".** Casi siempre
quiere decir que nadie la auditó nunca. Y es el caso que `manifest-drift.test.ts`
no puede atrapar: su filtro es `manifests.filter((m) => environment.length > 0)`,
así que una extensión con la lista vacía no se compara contra nada y pasa en
verde lea lo que lea. El instalador de `apps/platform` arma el formulario con
esos `environment[]`, así que esas 21 no se le piden nunca al cliente y el deploy
arranca con los defaults del código, en silencio.

Lo que sí lo atrapa es `descriptors/env-coverage.test.ts`, que parte del CÓDIGO
que la extensión posee según `resolve-ownership.js` en vez de partir del
manifest. Antes de migrar, corré ese test: su `PENDING_UNDECLARED_ENV` ya tiene
la lista de lo que le falta declarar a cada extensión.

Migrar una extensión **no** es leer su `environment[]`: es auditar sus lecturas
de env con ripgrep y de paso corregir el manifest. Contá ese trabajo al estimar.

## Paso 1 — Auditar y clasificar

```bash
rg -n "(process\.)?env[.\[]" <paths de la extensión>
```

**Ese patrón, y no `process\.env\.<PREFIJO>_`.** El grep obvio se pierde dos
formas de lectura que el repo usa en producción, y las dos son invisibles
justamente porque el grep no las encuentra:

1. **Record inyectado.** El entorno llega como parámetro para poder testearlo.
   `subscribers/correo-order.ts:42` y `workflows/correo-generate-tickets.ts:349`:

   ```ts
   export const isCorreoAutoFulfillEnabled = (
     env: Record<string, string | undefined> = process.env
   ): boolean => env.CORREO_ARGENTINO_AUTO_FULFILL?.trim().toLowerCase() === 'true';
   ```

   El texto `process.env.CORREO_ARGENTINO_AUTO_FULFILL` no existe en ningún lado.
   Por eso el `process\.` va **opcional**.

2. **Acceso dinámico por corchete.** El nombre de la variable está en otra línea.
   `modules/typesense/site-collection.ts:57` hace `process.env[envVar]` con
   `envVar` tipado como unión de literales, y `modules/arca/config.ts:35` hace
   `process.env[base64Var]` con el nombre llegando desde
   `readPem('ARCA_CERTIFICATE_BASE64', …)`. Ahí no hay ningún `env.ALGO` que
   grepear: cuando veas un `env[` que no es literal, buscá los literales
   `UPPER_SNAKE` del archivo y de sus llamadores.

   Esas dos de ARCA son un certificado X.509 y su clave privada de AFIP. Estuvieron
   invisibles hasta que `env-coverage.test.ts` las levantó.

Por si querés el prefijo igual, filtrá después:

```bash
rg -n "(process\.)?env[.\[]" <paths> | rg "<PREFIJO>_"
```

Para cada variable, cuatro preguntas en orden. La primera que da "sí" gana:

1. **¿Hace falta para abrir o descifrar la propia tabla?**
   (`DATABASE_URL`, `JWT_SECRET`, `CREDENTIAL_ENCRYPTION_KEY`)
   → se queda en env para siempre. Guardar la llave adentro de la caja fuerte no
   funciona.

   Sobre la clave de cifrado, que tuvo tres nombres y sólo uno servía: la KEK de
   todo lo que este backend cifra en reposo la resuelve
   `lib/shared/encryption-key.ts`. Se **escribe** con `CREDENTIAL_ENCRYPTION_KEY`
   y se **lee** probando también `APP_SETTINGS_ENC_KEY` y `JWT_SECRET`, en ese
   orden — la cadena de lectura es lo que permite adoptar la clave dedicada sin
   volver indescifrables los blobs viejos. `CREDENTIAL_ENCRYPTION_KEY` ya estaba
   en los `.env` de la gente sin que la leyera nadie; el docblock de ese archivo
   tiene el porqué del nombre y el camino de migración completo.

2. **¿Aparece en `medusa-config.ts` o `instrumentation.ts`?**
   → `envOnly`. No hay hook entre "config evaluada" y "contenedor construido":
   `get-config-file.js` usa `resolvedExports.default` sin `await`, y
   `start.js:186-192` evalúa la config **antes** de `registerInstrumentation`.

3. **¿Es un `schedule:` de `src/jobs/**`?**
→ `envOnly`. `job-loader.js:69-78` hornea el cron al arrancar. Lo que sí se
puede es un **kill switch** en DB (`enabled: false` → early return), que es el
   90% de lo que la gente quiere cuando pide "editar el cron".

4. **¿La lee más de una extensión?**
   → tiene UN dueño; las demás la declaran `envOnly` apuntando a él. Ver la regla
   completa abajo.

5. Si no → descriptor con `tier: 'runtime'`.

Todo lo que quede afuera va en `envOnly` **con una razón escrita**. El test de
deriva lo exige, y esa razón se muestra en la card.

### La regla de propiedad, para las variables compartidas

Al migrar la cola larga de extensiones apareció el cruce: `NEXT_PUBLIC_BASE_URL`
la leen cuatro, `DEFAULT_CURRENCY_CODE` tres, y `OPENROUTER_*`, `CHAT_AI_*`,
`STOREFRONT_DEFAULT_COUNTRY` y `MERCADOPAGO_*` dos o tres cada una.

El test que prohíbe declarar la misma env dos veces mira **dentro** de un
namespace, así que nada impide que tres extensiones la declaren cada una por su
lado. Y eso compila, pasa los tests y produce **tres cards editando el mismo
valor**: el operador cambia el modelo de IA en una pantalla, vuelve a otra y lo ve
distinto, o peor, lo cambia de nuevo y pisa lo que acababa de guardar.

La regla es:

> **Una variable la EDITA un solo namespace. Los demás que la leen la declaran en
> `envOnly` con un `reason` que nombre al dueño.**

Cómo elegir al dueño:

- **La extensión de la que la variable es CONCEPTUALMENTE parte**, no la que la
  usa más. `OPENROUTER_API_KEY` es de `ai-assistant` aunque `landing-pages`
  también genere texto: la cuenta de OpenRouter es del asistente.
- **Si es de infraestructura o de instalación, no es de nadie**: va `envOnly` en
  todas. `NEXT_PUBLIC_BASE_URL` la necesita el storefront en build time,
  `DEFAULT_CURRENCY_CODE` y `STOREFRONT_DEFAULT_COUNTRY` son configuración
  regional que se usa al sembrar y al indexar. Dos cards editando la moneda es
  cómo se termina con un catálogo mitad en pesos y mitad en dólares.
- **Si es una credencial, el dueño es quien la factura.** `MERCADOPAGO_ACCESS_TOKEN`
  es de `mercadopago` aunque `payment-benefits` la lea.

Ojo con no confundir esto con los **alias**, que son otra cosa:
`GOOGLE_MAPS_API_KEY` y `VITE_GOOGLE_MAPS_API_KEY` son dos nombres del MISMO
valor, y van en UN descriptor con `env: ['GOOGLE_MAPS_API_KEY', 'VITE_GOOGLE_MAPS_API_KEY']`,
en orden de precedencia. Variables compartidas = un dueño y varios `envOnly`;
alias = un solo descriptor con varias entradas en `env`.

## Paso 2 — Escribir el descriptor

`apps/backend/src/modules/app-settings/descriptors/<extension>.ts`. Copiar
`typesense.ts`, que es la referencia.

Tres reglas que hacen fallar el test si se ignoran:

- **Un secreto no puede tener `default`.** Quedaría en claro en el código.
- **Dos descriptores no pueden declarar la misma env var.** Los alias van en UN
  descriptor: `env: ['GA_MEASUREMENT_ID', 'NEXT_PUBLIC_GA_MEASUREMENT_ID']`, en
  orden de precedencia.
- **El `default` tiene que pasar su propia validación.** Un default fuera de
  `min`/`max` o que no matchea el `pattern` anda hasta que alguien abre la card,
  guarda sin tocar nada y se come un 400 inexplicable.

Usá `group` para partir la card. Con más de ~8 campos, sin grupos es ilegible.

## Paso 3 — El resolver, y elegir camino

Hay **dos** caminos de lectura y elegir mal es el error clásico.

### Async — el default

Para rutas, jobs, subscribers y workflows: todo lo que tenga contenedor.

```ts
const service = container.resolve(APP_SETTINGS_MODULE);
const value = await service.resolve(descriptor);
```

Memoizado 30 s por namespace en `src/lib/settings-cache.ts`, a prueba de
stampede (guarda la promesa, no el valor).

### Sincrónico — cuando no hay contenedor

Para constructores y `const` de nivel superior. Copiar
`modules/typesense/settings.ts`:

```ts
import { resolveSettingSync } from '../app-settings/resolve';
export function getMiExtensionSettings(): MiExtensionSettings {
  /* … */
}
```

Lee del snapshot que el loader de `app-settings` llena al arrancar. Antes de que
corra el loader devuelve el env — o sea, se comporta como antes de la migración.

### El tercer caso: providers

Un provider de pago, fulfillment o notificación corre en un contenedor
**hermético**. `load-internal.js` lo crea sin padre y le re-exporta seis claves:
`MANAGER`, `CONFIG_MODULE`, `LOGGER`, `PG_CONNECTION`, `EVENT_BUS`, `CACHING`.
`container.resolve(APP_SETTINGS_MODULE)` desde ahí **tira siempre**.

La salida es leer por `PG_CONNECTION` con knex crudo. Ya hay precedente en el
repo: `modules/kapso-whatsapp/service.ts:100-108` lee `store_setting` así,
comentado como _"sin resolver el módulo (aislado) store-config"_.

## Paso 4 — Refactorizar los call sites

El patrón mecánico para un `const` de nivel superior:

```diff
-const MODEL = process.env.MI_MODELO || 'default';
+const getModel = () => getMiExtensionSettings().model;
```

Hacelo en un commit aparte, sin cambio de comportamiento: es reviewable de un
vistazo y aísla el riesgo.

**Ojo con los clientes cacheados.** Si el service guarda un cliente HTTP en un
`static`, cambiar la config no tiene efecto hasta reiniciar. La solución es
cachear por **fingerprint** de la config y no por tiempo — ver
`typesense/service.ts` (`clientFingerprint`). Reconstruir en cada instanciación
no sirve: esos clientes suelen cachear un token.

## Paso 5 — La card en el admin

Una línea en la página de la extensión:

```tsx
<ExtensionSettingsCard namespace="extension:mi-extension" />
```

Con muchos campos, repartir por grupo entre tabs: `groups={['Conexión']}`.

## Paso 6 — Ensamblar

Cuatro archivos compartidos, en este orden:

1. `descriptors/index.ts` — import + entrada en `settingsNamespaces`.
2. `packages/project-composer/src/component-metadata.js` — el `environment[]`
   completo (descriptores **∪** `envOnly`).
3. `descriptors/manifest-drift.test.ts` — sacar el namespace de
   `PENDING_NAMESPACES`. Esa lista sólo puede achicarse: vaciarla es terminar la
   migración.
4. `descriptors/env-coverage.test.ts` — sacar de `PENDING_UNDECLARED_ENV` las
   variables de tu extensión. Misma regla: sólo achica. Si dejás una entrada que
   ya declaraste, el test te lo dice por nombre — la lista es la medida del
   trabajo que falta y una entrada muerta la vuelve mentira.

Si tu extensión **no aparece** en `PENDING_UNDECLARED_ENV` pero sabés que lee
env, el problema es de ownership antes que de descriptores: fijate que
`component-definitions.js` le asigne los paths. `modules/arca` estuvo sin dueño
—y por lo tanto sin manifest y sin instalador— hasta que se lo asignó a
`fiscal-documentation`, y el descubrimiento por imports no lo iba a encontrar
nunca porque sólo mira `api|jobs|links|scripts|subscribers|workflows|admin`,
nunca `modules/`.

Después:

```bash
node packages/project-composer/src/extract-components.js
```

**Nunca editar un manifest a mano.** Y ojo: `extract` reescribe los 41 manifests
porque los `sha256` de `managed_files[]` están desactualizados en ~40 de ellos
(deriva preexistente que nada valida — `verify` pasa igual). Revertí lo ajeno:

```bash
for f in $(git diff --name-only packages/extensions | grep -v '^packages/extensions/<tu-ext>/'); do
  git checkout -- "$f"
done
```

## Paso 7 — Verificar

```bash
cd apps/backend && npx tsc --noEmit && pnpm test
node packages/project-composer/src/verify-components.js
```

`src/admin` está **excluido** del tsconfig, así que un JSX roto no lo atrapa
nada hasta el build de Vite. La receta para validarlo a mano está comentada
dentro de `apps/backend/tsconfig.json`.

A mano, con el backend levantado:

1. Variable en env y sin fila → `source: 'env'`.
2. Guardar override → `source: 'db'`, y el valor nuevo se usa de verdad.
3. Borrar la fila → vuelve a `'env'`.
4. `APP_SETTINGS_DISABLE=true` → todo vuelve a env. Es el break-glass; que esté
   en el runbook y no se descubra durante un incidente.
5. Un secreto: confirmar por SQL que `value IS NULL` y que `ciphertext` arranca
   con `v1:`, y que el `GET` nunca devuelve el texto plano.

## Archivos que NO se editan a mano

Los regenera el composer y tu cambio se pierde en silencio:

- `apps/backend/src/admin/hooks/api/index.ts`
- `apps/backend/src/api/extension-middlewares.ts`
- `apps/backend/src/admin/i18n/index.ts`
- `packages/extensions/**` entero

Para algo **core** (que va siempre, no por extensión), agregarlo a la lista base
del `render*` correspondiente en
`packages/project-composer/src/extension-integrations.js`.
