# @minimalart/mercatto-plugin-runtime

Runtime coordination contract entre el host de Mercatto y los plugins publicados.

## Por qué existe

Cuando un plugin vive en `node_modules`, no puede importar directamente de `apps/backend/src/...`. Vendorizar los módulos del host tampoco sirve para settings — los singletons de snapshot son por proceso y por path físico: dos copias son dos snapshots distintos.

Este package expone **setters (host al arrancar) y getters (plugins en cada operación)** sobre un registro de `globalThis` identificado por `Symbol.for`. Desde 0.6.1, varias copias físicas compatibles comparten los lectores sin depender del hoisting. Cada proceso o worker debe registrar su propio lector; no se comparten credenciales entre procesos. Las versiones anteriores deben actualizarse junto con los consumidores.

## Qué expone

Los lectores de configuración se consultan en cada operación: no guardar el resultado
en un singleton del plugin. Landings, Banners y Gift Cards usan el lector sincrónico;
ARCA usa además `EXTERNAL_KEYS.APP_SETTINGS_VIA_PG`. Ese getter devuelve una función
`(namespace, pg, resolution) => Promise<Record<string, unknown> | undefined>` del host.
La función aplica la misma precedencia de tienda que el admin. Sus errores de base
se propagan para evitar consultar con la identidad fiscal de otra tienda.

Al actualizar estos consumidores, publicar e instalar el runtime junto con los
plugins antes de retirar las variables del entorno.

### `AppSettingsSyncReader`

Lector sincrónico del snapshot de `app-settings`. El host lo registra una vez con su propio `resolveSettingSync`; los plugins lo leen por `(namespace, key)`.

```ts
// Host boot
import { registerAppSettingsSyncReader } from '@minimalart/mercatto-plugin-runtime';
import { resolveSettingSync } from './modules/app-settings/resolve';
import allDescriptors from './modules/app-settings/descriptors';

const byNamespaceAndKey = new Map(/* ... */);
registerAppSettingsSyncReader((namespace, key) => {
  const descriptor = byNamespaceAndKey.get(`${namespace}:${key}`);
  return descriptor ? resolveSettingSync(descriptor) : undefined;
});
```

```ts
// Plugin runtime
import { getAppSettingsSyncReader } from '@minimalart/mercatto-plugin-runtime';

const reader = getAppSettingsSyncReader();
const value = reader?.('extension:abandoned-cart', 'ABANDONED_CART_STEP1_HOURS');
if (value === undefined) return fallbackToEnv();
```

### External module readers (genérico, por key)

Registry para módulos del host que un plugin quiere leer sin importarlos. Las keys viven en `EXTERNAL_KEYS`.

```ts
// Host boot
import { registerExternalReader, EXTERNAL_KEYS } from '@minimalart/mercatto-plugin-runtime';
import { getKapsoSettings } from './modules/kapso-whatsapp/settings';

registerExternalReader(EXTERNAL_KEYS.KAPSO_WHATSAPP_SETTINGS, () => getKapsoSettings());
```

```ts
// Plugin runtime
import { getExternalReader, EXTERNAL_KEYS } from '@minimalart/mercatto-plugin-runtime';

type KapsoSettings = { templates: { cartAbandoned1: string | null /* ... */ } };
const reader = getExternalReader<KapsoSettings>(EXTERNAL_KEYS.KAPSO_WHATSAPP_SETTINGS);
const templates = reader?.()?.templates;
```

## Fallback cuando el host no registró

- Los getters devuelven `null` en vez de lanzar.
- Los plugins caen a sus defaults (`process.env`, valor hardcodeado, feature off) usando esa señal.

## Cuándo agregar una nueva key al registry

- Sos el segundo consumidor de un módulo del host (el primero puede vivir con setter/getter propios).
- La shape del módulo es estable y bien tipada.
- Documentar la key en `EXTERNAL_KEYS` y explicar la semántica.

## DrawerTabs (0.6.0)

El subpath público `@minimalart/mercatto-plugin-runtime/admin` exporta
`DrawerTabs` y `DrawerTabPanel`, extraídos del componente canónico de Tiendas/B2B.
El host conserva sus imports mediante una reexportación; los plugins no necesitan
importar archivos internos de `apps/backend`.

Pasar `previousLabel` y `nextLabel` desde las traducciones del consumidor.
El componente usa React y los iconos de Medusa; ambos peers son opcionales para
consumidores que usan únicamente el contrato de servidor. `DrawerTabPanel`
mantiene la opción `forceMount` para formularios que conservan estado local.
