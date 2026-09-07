/**
 * Normalización PURA de las options de Andreani. Cero I/O, cero `process.env`.
 *
 * `normalizeAndreaniOptions()` es la ÚNICA normalización del módulo, y por eso
 * `settings.ts` —que resuelve contra `site_setting` con la precedencia de
 * `app-settings`— llama acá en vez de parsear por su cuenta. Antes había DOS
 * mitades: el loader de entorno vivía en este archivo y la normalización era un
 * `private static` de `service.ts:477-556`, así que todo lo que no pasaba por el
 * provider —el workflow de tickets, el job, la descarga de rótulos, las rutas
 * store— operaba con options a medio normalizar. Correo ya tenía las dos juntas;
 * esto lo empareja.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ ACÁ YA NO SE LEE `process.env`. Ni una vez.                               │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Diferencia deliberada con `correo-argentino-fulfillment/env-options.ts`, que sí
 * conserva un loader de entorno: Correo declara sus 43 variables en el
 * `environment[]` del manifest y Andreani declaraba 7 de 27. El ratchet de
 * `descriptors/env-coverage.test.ts` marca en rojo toda env var que una extensión
 * LEA y no declare, y su salida recomendada es justamente ésta — darle un descriptor
 * en vez de leerla a mano. El entorno sigue siendo la capa de fallback: lo lee
 * `app-settings/validate.ts:coerceFromEnv` a partir del `env: [...]` de cada
 * descriptor, que es la declaración.
 *
 * Para el arranque, ver `settings.ts:getAndreaniBootOptions()`: es lo que
 * `medusa-config.ts` requiere perezosamente, en lugar de la copia línea por línea
 * que tenía en `medusa-config.ts:18-41` con un comentario pidiendo mantener las dos
 * en sync a mano.
 */

import type {
  AndreaniContractOverrides,
  AndreaniProviderOptions,
  AndreaniServiceType,
} from './types';

/**
 * LOS defaults. Están también en `descriptors/andreani.ts`, porque la UI los
 * necesita como DATO para dibujar el input y mostrar lo heredado en gris.
 * `descriptor.test.ts` cruza las dos listas: es la única forma de tener el default
 * en los dos lados sin que puedan divergir.
 */
export const ANDREANI_DEFAULTS = {
  /**
   * QA, no producción. Es lo que hacía el loader viejo
   * (`process.env.ANDREANI_HOSTNAME || 'apisqa.andreani.com'`) y se conserva tal
   * cual para que la migración no cambie a qué API le pega una instalación viva.
   * Efecto colateral heredado: la rama `testMode ? qa : prod` de abajo no se alcanza
   * nunca desde el loader, porque el hostname siempre llega con valor.
   *
   * Que el default sea el ambiente de prueba es una trampa conocida, y se desactivó
   * por otros dos lados en vez de moviéndolo: el descriptor pasó a ser un `enum` con
   * las dos opciones etiquetadas ("Prueba (QA)" / "Producción") para que la elección
   * sea explícita, y `getAndreaniBootOptions()` loguea un warning al arrancar si
   * `NODE_ENV=production` y el host sigue siendo el de QA. El razonamiento completo
   * está en la nota 3 de `app-settings/descriptors/andreani.ts`.
   */
  hostname: 'apisqa.andreani.com',
  senderName: 'Remitente',
  dimensionFallback: { length: 30, width: 20, height: 15, weight: 0.5 },
} as const;

/** El piso de `normalizeAndreaniOptions`: nada de entorno, nada de base. */
const DEFAULT_OPTIONS: AndreaniProviderOptions = {
  hostname: ANDREANI_DEFAULTS.hostname,
  username: '',
  password: '',
  contract: '',
  clientCode: undefined,
  testMode: false,
  sender: { name: ANDREANI_DEFAULTS.senderName },
  origin: { postalCode: '', street: '', number: '', city: '', province: '' },
  dimensionFallback: { enabled: false, ...ANDREANI_DEFAULTS.dimensionFallback },
};

type RawProviderOptions = Record<string, unknown> | undefined;

const readStr = (source: Record<string, unknown>, key: string): string | undefined => {
  const value = source[key];
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
};

const readBool = (value: unknown, current: boolean): boolean => {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return current;
};

/**
 * Normaliza options crudas —vengan de `medusa-config.ts`, del entorno o de
 * `site_setting`— contra una `base`.
 *
 * Dos cosas que cambiaron al mudarla acá desde `service.ts`, y que valen la pena:
 *
 * 1. **YA NO TIRA.** El original exigía `username`, `password` y `contract` y
 *    lanzaba si faltaba alguno. Combinado con el gate de `medusa-config.ts:455`
 *    —que registra el provider si `ANDREANI_USERNAME` está seteada— eso era una
 *    bomba: con el usuario puesto y la contraseña vacía, el provider explotaba EN EL
 *    CONSTRUCTOR y el backend no arrancaba. Una credencial incompleta no puede tirar
 *    abajo la tienda entera. Ahora se degrada, siguiendo el precedente de
 *    `kapso-whatsapp/service.ts:79-93`: se registra siempre y, sin credenciales,
 *    loguea en vez de fallar. Quién avisa: `hasAndreaniCredentials()`, en cada camino
 *    que necesita autenticar.
 *
 * 2. **`base` es un parámetro.** El provider la usa para re-normalizar sus options
 *    del boot contra la configuración de OTRA tienda: sin eso, una instalación que
 *    hardcodea credenciales en `medusa-config.ts` las perdería en cuanto la tienda
 *    tuviera fila propia, o al revés.
 */
export function normalizeAndreaniOptions(
  options: RawProviderOptions,
  base: AndreaniProviderOptions = DEFAULT_OPTIONS,
): AndreaniProviderOptions {
  const opts = options ?? {};
  const sender = (opts.sender as Record<string, unknown>) ?? {};
  const origin = (opts.origin as Record<string, unknown>) ?? {};
  const fallback = (opts.dimensionFallback as Record<string, unknown>) ?? {};

  const testMode = readBool(opts.testMode, base.testMode);

  const num = (key: string, current: number): number => {
    const parsed = Number(fallback[key]);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : current;
  };

  return {
    // El `?? (testMode ? …)` es la rama que el loader de entorno no alcanza nunca
    // (ver `ANDREANI_DEFAULTS.hostname`). Sí la alcanza quien construya options a
    // mano sin hostname, así que se conserva.
    hostname:
      readStr(opts, 'hostname') ??
      (base.hostname || (testMode ? 'apisqa.andreani.com' : 'apis.andreani.com')),
    username: readStr(opts, 'username') ?? base.username,
    password: readStr(opts, 'password') ?? base.password,
    contract: readStr(opts, 'contract') ?? base.contract,
    clientCode: readStr(opts, 'clientCode') ?? base.clientCode,
    testMode,
    sender: {
      name: readStr(sender, 'name') ?? base.sender.name,
      email: readStr(sender, 'email') ?? base.sender.email,
      phone: readStr(sender, 'phone') ?? base.sender.phone,
      documentType: readStr(sender, 'documentType') ?? base.sender.documentType,
      documentNumber: readStr(sender, 'documentNumber') ?? base.sender.documentNumber,
    },
    origin: {
      postalCode: readStr(origin, 'postalCode') ?? base.origin.postalCode,
      street: readStr(origin, 'street') ?? base.origin.street,
      number: readStr(origin, 'number') ?? base.origin.number,
      city: readStr(origin, 'city') ?? base.origin.city,
      province: readStr(origin, 'province') ?? base.origin.province,
    },
    dimensionFallback: {
      enabled: readBool(fallback.enabled, base.dimensionFallback.enabled),
      length: num('length', base.dimensionFallback.length),
      width: num('width', base.dimensionFallback.width),
      height: num('height', base.dimensionFallback.height),
      weight: num('weight', base.dimensionFallback.weight),
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Credenciales por tienda                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Lo que una tienda puede sobreescribir de las credenciales de instancia.
 *
 * Son las cuatro claves del blob de `site_credential` con integración `andreani`
 * (`api/admin/site-credentials/catalog.ts:50-55`). El nombre de cada clave es un
 * CONTRATO con esa pantalla: renombrar una acá y no allá deja a la tienda
 * despachando con la cuenta de la instancia sin un solo error.
 */
export type AndreaniSiteCredentials = {
  username?: string;
  password?: string;
  contract?: string;
  clientCode?: string;
};

const override = (value: string | undefined, current: string): string =>
  typeof value === 'string' && value.trim() ? value.trim() : current;

/**
 * Aplica las credenciales de la tienda sobre las opciones resueltas.
 *
 * Gemelo tipado de `applyCorreoSiteCredentials`. Andreani hacía un
 * `{ ...this.options_, ...creds.value }` (`service.ts:116`) que funciona de casualidad,
 * porque su blob es PLANO y sus cuatro claves se llaman igual que en
 * `AndreaniProviderOptions`. Correo ya pagó ese atajo: su blob también es plano pero
 * sus opciones NO, así que `micorreoUser` y `customerId` quedaban colgando en la raíz
 * y la tienda cotizaba con la identidad de otro comerciante en silencio.
 *
 * Acá no hay bug hoy, pero el spread tiene dos problemas que una función nombrada no:
 *
 *  - Un string VACÍO en el blob pisaba el valor bueno. `{ password: '' }` guardado a
 *    mano dejaba al cliente sin contraseña. `override()` trata el vacío como ausencia,
 *    igual que en Correo.
 *  - Cualquier clave de más en el blob entraba en las opciones. Con el spread, un
 *    `{ hostname: 'apis...' }` cargado por error apuntaba esa tienda a otro entorno de
 *    Andreani, que es config de INSTANCIA. Acá sólo entran las cuatro que existen.
 */
export function applyAndreaniSiteCredentials(
  options: AndreaniProviderOptions,
  creds: AndreaniSiteCredentials,
): AndreaniProviderOptions {
  return {
    ...options,
    username: override(creds.username, options.username),
    password: override(creds.password, options.password),
    contract: override(creds.contract, options.contract),
    clientCode: override(creds.clientCode, options.clientCode ?? '') || undefined,
  };
}

/* -------------------------------------------------------------------------- */
/* Contratos por servicio                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Etiquetas que la gente escribe en el campo del contrato creyendo que es un
 * selector de servicio. Andreani las rechaza, y el síntoma es una tarifa en cero.
 */
const INVALID_CONTRACT_LABELS = new Set([
  'a domicilio',
  'domicilio',
  'sucursal',
  'puntodetercero',
  'punto de tercero',
]);

const isValidContract = (value?: string | null): boolean => {
  const normalized = value?.trim().toLowerCase() || '';
  return normalized.length > 0 && !INVALID_CONTRACT_LABELS.has(normalized);
};

/**
 * El contrato a usar para un servicio, honrando el override de ese servicio.
 *
 * `overrides` es OBLIGATORIO desde esta migración, y ese es el arreglo. Antes esta
 * función leía `process.env.ANDREANI_*_CONTRACT_OVERRIDE` adentro
 * (`env-options.ts:70-72`), o sea que los tres overrides ni siquiera pasaban por las
 * options del provider: una tienda con credenciales propias seguía cotizando y
 * despachando con el override de la instancia, y nada en la firma lo delataba.
 *
 * Que no tenga default es deliberado: con uno, un call site nuevo que se olvide de
 * pasar los de la tienda compila y reintroduce el bug en silencio. Sin default, el
 * compilador obliga a decidir de QUIÉN son los overrides.
 */
export function resolveContractForService(
  serviceType: AndreaniServiceType,
  baseContract: string,
  overrides: AndreaniContractOverrides,
): string {
  const candidates = [overrides[serviceType], baseContract];
  return candidates.find((c) => isValidContract(c)) || baseContract;
}
