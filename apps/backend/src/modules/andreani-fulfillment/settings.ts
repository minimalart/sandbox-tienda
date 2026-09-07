import { SCOPE_SEPARATOR, memoNamespace } from '../../lib/settings-cache';
import type { SiteResolution } from '../../lib/multistore/types';
import andreaniDescriptors from '../app-settings/descriptors/andreani';
import { resolveEffectiveValue, type AppSettingRow, type SettingScopeRows } from '../app-settings/resolve';
import { readEntriesFromBlob } from '../app-settings/site-setting-store';
import { getSnapshotRow } from '../app-settings/snapshot';
import { normalizeAndreaniOptions } from './env-options';
import type { AndreaniContractOverrides, AndreaniProviderOptions } from './types';

/**
 * Configuración efectiva de Andreani, con la precedencia de `app-settings`.
 *
 * Hay DOS entradas, y elegir mal es el error clásico:
 *
 *  - `getAndreaniSettings()` — SINCRÓNICA, lee del snapshot que el loader de
 *    `app-settings` llena al arrancar. Es la de todo call site sin contenedor: el
 *    job de tracking, el transformer de las rutas custom, el fallback del provider
 *    y `medusa-config.ts` (vía `getAndreaniBootOptions()`). Mismo patrón que
 *    `typesense/settings.ts`.
 *
 *  - `loadAndreaniSettingsViaPg(pg, resolution)` — ASÍNCRONA, lee `site_setting`
 *    con knex crudo y memoiza 30 s POR SCOPE. Es la única que ve la capa de
 *    TIENDA, y es la que tienen que usar el provider de fulfillment (container
 *    aislado, sólo `PG_CONNECTION`) y todo camino que sepa de qué tienda es la
 *    orden.
 *
 * Las dos comparten el MISMO cálculo (`buildSettings`) y el mismo resolver, así
 * que no hay dos definiciones de precedencia que puedan divergir. Es la plantilla
 * de `kapso-whatsapp/settings.ts`, con una diferencia que importa:
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ ACÁ EL CAMINO ASYNC SÍ LEE LA FILA DE LA TIENDA. Kapso no puede —una      │
 * │ notificación no trae tienda—, pero una cotización trae el sales channel   │
 * │ del carrito y un despacho trae la orden, así que acá sí hay de dónde.     │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Por qué importa tanto en Andreani y no en otras extensiones: el CONTRATO define
 * la tarifa y la cuenta define a quién se le factura el envío. Resolver la
 * configuración de la instancia cuando la orden es de la tienda B significa
 * cotizar un precio que después no se puede despachar, o despachar contra el
 * contrato de otro titular. Ese era el bug que motivó este archivo: la cotización
 * (`service.ts:calculatePrice`) ya resolvía las credenciales por tienda, pero el
 * ALTA DEL ENVÍO (`workflows/andreani-generate-tickets.ts`) construía su cliente
 * desde el entorno. Una tienda cotizaba con su cuenta y despachaba con la de la
 * instancia.
 *
 * LO QUE ESTE ARCHIVO NO HACE: las credenciales por tienda (usuario, contraseña,
 * contrato, código de cliente) NO viven en `site_setting` sino en
 * `site_credential`, cifradas con otra clave. Se aplican encima con
 * `applyAndreaniSiteCredentials` (`env-options.ts`). Acá se resuelve todo lo
 * demás, y la capa de instancia de esas cuatro.
 */

export const ANDREANI_SETTINGS_NAMESPACE = andreaniDescriptors.namespace;

/** Se re-exporta desde `types.ts`: el nombre ya estaba publicado desde acá. */
export type { AndreaniContractOverrides } from './types';

export type AndreaniSettings = {
  /** Todo lo que el cliente HTTP y el transformer necesitan, ya normalizado. */
  options: AndreaniProviderOptions;
  /**
   * Andreani cotiza CADA servicio bajo su propio contrato. Antes vivían en
   * `process.env` leídas adentro del provider, sin pasar por las options: eran
   * inmunes a las credenciales por tienda.
   */
  contractOverrides: AndreaniContractOverrides;
  /** `ANDREANI_AUTO_FULFILL`. Por tienda: el flujo operativo puede diferir. */
  autoFulfill: boolean;
  /** `ANDREANI_TRACKING_BUSINESS_HOURS_ONLY`. De la instancia: el job es uno solo. */
  trackingBusinessHoursOnly: boolean;
};

/**
 * De dónde salen las DOS capas de base de una key. Es lo único que cambia entre
 * el camino sincrónico (sólo global, desde el snapshot) y el async (tienda +
 * global, desde `site_setting`).
 */
type ScopeLookup = (key: string) => SettingScopeRows;

const byKey = new Map(andreaniDescriptors.settings.map((d) => [d.key, d]));

const snapshotLookup: ScopeLookup = (key) => ({
  global: getSnapshotRow(ANDREANI_SETTINGS_NAMESPACE, key),
});

/**
 * EL cálculo. Único para los dos caminos.
 *
 * `resolution` es lo que habilita la capa de tienda y el fail-closed de la
 * decisión 3: sin ella `resolveEffectiveValue` resuelve como instancia y ni mira
 * `rows.site`.
 *
 * Los valores resueltos se pasan CRUDOS a `normalizeAndreaniOptions`, que es la
 * única normalización del módulo (vive en `env-options.ts`). Acá no hay una segunda
 * tabla de defaults: `read` devuelve `undefined` cuando no hay valor y el piso lo
 * pone el normalizador. Duplicar los defaults sería la forma de que el provider
 * cotice con una configuración y el workflow despache con otra.
 *
 * Para una tienda secundaria que no declaró nada, la precedencia devuelve `'off'`
 * (`undefined`) y el normalizador pone su piso — igual que en `kapso-whatsapp`. NO
 * es un agujero de aislamiento: nunca se lee el valor de otra tienda, lo que se
 * pierde es la personalización. Y para lo que sí es peligroso —usuario, contraseña,
 * contrato— el piso es la cadena vacía, o sea que la tienda queda sin poder
 * autenticar en vez de despachar con la cuenta de la instancia.
 */
function buildSettings(lookup: ScopeLookup, resolution?: SiteResolution): AndreaniSettings {
  /** El valor efectivo, o `undefined` si ninguna capa lo aportó. */
  const read = (key: string): unknown => {
    const descriptor = byKey.get(key);
    if (!descriptor) return undefined;
    return resolveEffectiveValue(descriptor, lookup(key), { resolution });
  };

  /** Igual, pero un string vacío o de sólo espacios cuenta como ausente. */
  const readOptional = (key: string): string | undefined => {
    const value = read(key);
    if (value === undefined || value === null) return undefined;
    const trimmed = String(value).trim();
    return trimmed === '' ? undefined : trimmed;
  };

  const readFlag = (key: string): boolean => read(key) === true;

  return {
    options: normalizeAndreaniOptions({
      hostname: readOptional('ANDREANI_HOSTNAME'),
      username: readOptional('ANDREANI_USERNAME'),
      password: readOptional('ANDREANI_PASSWORD'),
      contract: readOptional('ANDREANI_CONTRACT'),
      clientCode: readOptional('ANDREANI_CLIENT_CODE'),
      testMode: read('ANDREANI_TEST_MODE'),
      sender: {
        name: readOptional('ANDREANI_SENDER_NAME'),
        email: readOptional('ANDREANI_SENDER_EMAIL'),
        phone: readOptional('ANDREANI_SENDER_PHONE'),
        documentType: readOptional('ANDREANI_SENDER_DOC_TYPE'),
        documentNumber: readOptional('ANDREANI_SENDER_DOC_NUMBER'),
      },
      origin: {
        postalCode: readOptional('ANDREANI_ORIGIN_POSTAL_CODE'),
        street: readOptional('ANDREANI_ORIGIN_STREET'),
        number: readOptional('ANDREANI_ORIGIN_NUMBER'),
        city: readOptional('ANDREANI_ORIGIN_CITY'),
        province: readOptional('ANDREANI_ORIGIN_PROVINCE'),
      },
      dimensionFallback: {
        enabled: read('ANDREANI_DIMENSION_FALLBACK_ENABLED'),
        length: read('ANDREANI_DIMENSION_FALLBACK_LENGTH'),
        width: read('ANDREANI_DIMENSION_FALLBACK_WIDTH'),
        height: read('ANDREANI_DIMENSION_FALLBACK_HEIGHT'),
        weight: read('ANDREANI_DIMENSION_FALLBACK_WEIGHT'),
      },
    }),
    contractOverrides: {
      Domicilio: readOptional('ANDREANI_DOMICILIO_CONTRACT_OVERRIDE'),
      Sucursal: readOptional('ANDREANI_SUCURSAL_CONTRACT_OVERRIDE'),
      PuntoDeTercero: readOptional('ANDREANI_PUNTO_DE_TERCERO_CONTRACT_OVERRIDE'),
    },
    autoFulfill: readFlag('ANDREANI_AUTO_FULFILL'),
    trackingBusinessHoursOnly: readFlag('ANDREANI_TRACKING_BUSINESS_HOURS_ONLY'),
  };
}

/**
 * Camino SINCRÓNICO — configuración de la INSTANCIA.
 *
 * Antes de que corra el loader de `app-settings` devuelve lo que hay en
 * `process.env`, o sea que se comporta exactamente como antes de esta migración.
 * Es lo que hace seguro que `medusa-config.ts` la invoque al evaluar la config.
 */
export function getAndreaniSettings(): AndreaniSettings {
  return buildSettings(snapshotLookup);
}

/**
 * Las options del provider para `medusa-config.ts`. ES la única razón de existir.
 *
 * Reemplaza a `loadAndreaniOptionsFromEnv()` y, sobre todo, a la copia línea por
 * línea que `medusa-config.ts:18-41` tenía del loader, con un comentario en
 * `env-options.ts:10-11` pidiendo mantener las dos en sync a mano. Dos listas de env
 * vars que pueden divergir significan que el provider arranca con una configuración
 * y el resto del módulo lee otra, y el síntoma —envíos creados con un origen o un
 * contrato distinto al cotizado— no apunta al archivo de config. Correo ya resolvía
 * esto con un `require` perezoso (`medusa-config.ts:56-59`); esto lo copia.
 *
 * Cuándo corre: al EVALUAR la config, antes de que exista el contenedor y por lo
 * tanto antes de que el loader de `app-settings` llene el snapshot. En ese momento
 * `getAndreaniSettings()` no tiene ninguna fila y resuelve `env → default`, que es
 * exactamente lo que hacía el loader viejo. Después, en runtime, el provider vuelve
 * a resolver por tienda en cada llamada (`service.ts:contextForChannel`), así que
 * estas options quedan sólo como piso.
 */
export function getAndreaniBootOptions(): AndreaniProviderOptions {
  const options = getAndreaniSettings().options;
  warnIfProductionPointsAtQa(options.hostname);
  return options;
}

/**
 * Grita si una instalación PRODUCTIVA está apuntando al entorno de prueba.
 *
 * El default de `ANDREANI_HOSTNAME` es `apisqa.andreani.com` y se conserva a
 * propósito (ver la nota 3 de `descriptors/andreani.ts`), lo que deja abierta una
 * trampa: un deploy productivo que no setea la variable ni toca la card cotiza y
 * despacha contra QA. No falla nada — los envíos "se crean", las etiquetas se
 * imprimen— y el paquete no lo retira nadie. Un log al arrancar es lo único que
 * puede delatarlo antes de la primera venta.
 *
 * Sólo con `NODE_ENV=production`: en desarrollo apuntar a QA es lo correcto, y un
 * warning en cada `pnpm dev` se vuelve invisible en dos días — que es exactamente
 * lo que le pasaría a este.
 *
 * `console.warn` y no el logger de Medusa porque esto corre al EVALUAR
 * `medusa-config.ts`: todavía no hay contenedor de donde sacarlo.
 */
function warnIfProductionPointsAtQa(hostname: string): void {
  if (process.env.NODE_ENV !== 'production') return;
  if (!hostname.toLowerCase().includes('apisqa.')) return;

  console.warn(
    '[andreani] ⚠️  NODE_ENV=production pero la API apunta al entorno de PRUEBA ' +
      '(apisqa.andreani.com). Los envíos que se creen no existen para Andreani y ' +
      'las etiquetas no valen. Elegí "Producción" en Ajustes → Andreani → Entorno ' +
      'de la API, o seteá ANDREANI_HOSTNAME=apis.andreani.com.',
  );
}

/** Conexión knex mínima que necesitan los caminos async. */
export type PgRawConnection = {
  raw: (sql: string, bindings?: unknown[]) => Promise<{ rows?: unknown[] }>;
};

/**
 * Lee el jsonb de UN scope de `site_setting` y lo desarma en filas por clave.
 *
 * Memoiza con la clave PELADA del namespace para la global y con
 * `namespace::siteId` para la tienda — el `SCOPE_SEPARATOR` de
 * `lib/settings-cache.ts`. Cachear las dos bajo la misma entrada era el bug que ese
 * archivo documenta: la primera request de la tienda A dejaba su jsonb cacheado y
 * la tienda B leía el de A durante todo el TTL. `invalidateNamespace()` borra el
 * namespace Y todos sus scopes, así que la ruta de admin que escribe ya limpia esto
 * sin código extra.
 */
async function readScope(
  pg: PgRawConnection,
  siteId: string | null,
): Promise<Map<string, AppSettingRow>> {
  const cacheKey =
    siteId === null
      ? ANDREANI_SETTINGS_NAMESPACE
      : `${ANDREANI_SETTINGS_NAMESPACE}${SCOPE_SEPARATOR}${siteId}`;

  return memoNamespace(cacheKey, async () => {
    const result = await pg.raw(
      `SELECT "value"
         FROM "site_setting"
        WHERE "namespace" = ?
          AND ${siteId === null ? '"site_id" IS NULL' : '"site_id" = ?'}
          AND "deleted_at" IS NULL
        LIMIT 1`,
      siteId === null ? [ANDREANI_SETTINGS_NAMESPACE] : [ANDREANI_SETTINGS_NAMESPACE, siteId],
    );
    const blob = (result?.rows ?? [])[0] as { value?: unknown } | undefined;
    return readEntriesFromBlob(blob?.value);
  });
}

/**
 * Camino ASÍNCRONO por `PG_CONNECTION`, con capa de TIENDA.
 *
 * Sin `resolution` (o con una que no es `status: 'site'`) se comporta igual que el
 * sincrónico: `global ?? env ?? default`. Con una tienda concreta agrega su fila y
 * le aplica la precedencia completa, fail-closed incluido.
 *
 * Desarma el jsonb con `readEntriesFromBlob`, la misma función que usan el camino
 * async del admin y el loader del snapshot. Tener un segundo parser del sobre sería
 * la forma de que el provider y la card discrepen sobre qué es un secreto.
 *
 * Si Postgres no responde o la tabla todavía no existe, cae al camino sincrónico en
 * vez de tirar: una config que no se puede leer nunca debe cortar una cotización.
 * OJO con la asimetría deliberada — las CREDENCIALES sí cortan cuando la tienda
 * declaró las suyas y no se pueden descifrar (`lib/multistore/credentials.ts:117`).
 * Config ilegible se degrada; credencial ilegible no, porque despachar con la cuenta
 * de otro titular es peor que fallar.
 */
export async function loadAndreaniSettingsViaPg(
  pg: PgRawConnection | undefined,
  resolution?: SiteResolution,
): Promise<AndreaniSettings> {
  if (!pg) return getAndreaniSettings();

  const siteId = resolution?.status === 'site' ? resolution.site.id : null;

  try {
    const globalRows = await readScope(pg, null);
    const siteRows = siteId ? await readScope(pg, siteId) : undefined;

    return buildSettings(
      (key) => ({ site: siteRows?.get(key), global: globalRows.get(key) }),
      resolution,
    );
  } catch {
    return getAndreaniSettings();
  }
}

/**
 * Huella de lo que afecta al CLIENTE HTTP de Andreani.
 *
 * `AndreaniClient` cachea el token 23 h en la instancia (`client.ts:44-46`) y
 * Andreani tiene rate limit propio (`AndreaniRateLimitError`, `client.ts:334`), así
 * que construir un cliente nuevo por cotización sería un `/login` por cotización.
 * Por eso el cache de clientes es POR HUELLA y no por tiempo — mismo criterio que
 * `typesense/service.ts:clientFingerprint` y `kapso-whatsapp/settings.ts`.
 *
 * Sólo entran los campos que el cliente usa para conectarse y autenticar. Cambiar el
 * remitente o el origen NO tiene por qué tirar un token que sigue siendo válido.
 */
export function credentialsFingerprint(
  options: Pick<
    AndreaniProviderOptions,
    'hostname' | 'username' | 'password' | 'contract' | 'clientCode'
  >,
): string {
  return [
    options.hostname,
    options.username,
    options.password,
    options.contract,
    options.clientCode ?? '',
  ].join('|');
}

/** `true` si hay con qué autenticar. Sin esto el cliente sólo puede loguear el fallo. */
export function hasAndreaniCredentials(
  options: Pick<AndreaniProviderOptions, 'username' | 'password' | 'contract'>,
): boolean {
  return Boolean(options.username && options.password && options.contract);
}
