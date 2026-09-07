import { readFileSync } from 'fs';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { MedusaContainer } from '@medusajs/framework/types';
import type { SiteResolution } from '../../lib/multistore/types';
import {
  getArcaSettings,
  loadArcaSettingsViaPg,
  type ArcaSettings,
  type PgRawConnection,
} from './settings';
import { ArcaConfigError, type ArcaEnvironment } from './types';

/** Global Minimalart lookup account: saved instance settings, then environment,
 * then legacy PEM files. Store credentials and queried CUITs never select the
 * authentication identity. No certificate or key material is logged. */
export type ArcaConfig = {
  cuitRepresentada: string;
  certificatePem: string;
  privateKeyPem: string;
  environment: ArcaEnvironment;
  service: string;
  urls: { wsaa: string; padron: string };
};

/** Lo mínimo del logger de Medusa. Evita arrastrar el tipo entero hasta acá. */
type MinimalLogger = { warn: (message: string) => void };

/* -------------------------------------------------------------------------- */
/* Normalización del PEM                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Convierte lo que haya en la capa de base64 a un PEM.
 *
 * Acepta las TRES formas que aparecen en producción, y no es tolerancia gratuita:
 *
 *  - base64 de un PEM, que es lo que sugiere la documentación de AFIP;
 *  - el PEM crudo multilínea, porque DO App Platform guarda el valor tal cual y
 *    exigir base64 sólo suma fricción (caso real de prod);
 *  - el PEM crudo con los saltos escapados como `\n`, que es lo que queda cuando el
 *    valor pasó por un JSON o por un input de una sola línea.
 *
 * Devuelve `null` cuando la capa no aportó nada, para que el caller siga bajando en
 * la precedencia. Sólo TIRA cuando SÍ había algo y no era un PEM: eso no es "falta
 * configuración" sino una configuración rota, y seguir de largo hacia el disco
 * escondería el problema real detrás de un error que nombra otra variable.
 */
export function decodePemMaterial(
  raw: string | undefined | null,
  label: string,
  sourceName: string
): string | null {
  const inline = String(raw ?? '').trim();
  if (!inline) return null;

  if (inline.includes('-----BEGIN')) {
    return inline.replace(/\\n/g, '\n').trim();
  }

  const pem = Buffer.from(inline, 'base64').toString('utf8').trim();
  if (!pem.includes('-----BEGIN')) {
    throw new ArcaConfigError(
      `${sourceName} no contiene ${label} válido (ni PEM crudo ni base64 de un PEM).`
    );
  }
  return pem;
}

/**
 * Escalón 4: el PEM desde un archivo del contenedor.
 *
 * El `process.env` es DIRECTO y no dinámico (`process.env[nombre]`) a propósito. El
 * acceso dinámico del loader viejo era invisible para todo grep del repo —por eso
 * estas 7 variables no aparecían en ningún inventario— y `env-coverage.test.ts` tuvo
 * que agregar una heurística entera (cosechar literales UPPER_SNAKE de los archivos
 * con corchete dinámico) sólo para atraparlas. Con el acceso directo, las dos únicas
 * env que este módulo sigue leyendo a mano se ven de lejos.
 */
function pemFromLegacyPath(
  path: string | undefined,
  label: string,
  pathVar: string
): string | null {
  const trimmed = path?.trim();
  if (!trimmed) return null;
  try {
    return readFileSync(trimmed, 'utf8').trim();
  } catch {
    // El mensaje nombra la VARIABLE, nunca la ruta: un path filtra la estructura
    // del contenedor y no ayuda a diagnosticar más que el nombre.
    throw new ArcaConfigError(`No se pudo leer ${label} desde ${pathVar}.`);
  }
}

/**
 * El par ya materializado, aplicando los escalones 3 y 4 sobre lo que resolvieron
 * el 1 y el 2.
 *
 * Los dos `process.env.*_PATH` se leen ACÁ y no en `settings.ts` porque son
 * `envOnly`: no tienen descriptor, así que `app-settings` no los resuelve. Que la
 * única lectura de entorno cruda que le queda al módulo sea la de los dos paths
 * legacy es exactamente el estado que esta migración persigue.
 */
function materializePair(settings: ArcaSettings): {
  certificatePem: string;
  privateKeyPem: string;
} {
  const certificatePem =
    decodePemMaterial(
      settings.certificateBase64,
      'un certificado X.509',
      'ARCA_CERTIFICATE_BASE64'
    ) ??
    pemFromLegacyPath(
      process.env.ARCA_CERTIFICATE_PATH,
      'el certificado X.509',
      'ARCA_CERTIFICATE_PATH'
    );

  const privateKeyPem =
    decodePemMaterial(settings.privateKeyBase64, 'una clave privada', 'ARCA_PRIVATE_KEY_BASE64') ??
    pemFromLegacyPath(
      process.env.ARCA_PRIVATE_KEY_PATH,
      'la clave privada',
      'ARCA_PRIVATE_KEY_PATH'
    );

  if (!certificatePem) {
    throw new ArcaConfigError(
      'Falta el certificado X.509 de ARCA (cargalo en la pantalla de credenciales de la ' +
        'tienda, en ARCA_CERTIFICATE_BASE64, o dejá ARCA_CERTIFICATE_PATH en el entorno).'
    );
  }
  if (!privateKeyPem) {
    throw new ArcaConfigError(
      'Falta la clave privada de ARCA (cargala en la pantalla de credenciales de la ' +
        'tienda, en ARCA_PRIVATE_KEY_BASE64, o dejá ARCA_PRIVATE_KEY_PATH en el entorno).'
    );
  }
  return { certificatePem, privateKeyPem };
}

/**
 * De la configuración resuelta a la config lista para firmar. Función PURA salvo por
 * los dos paths legacy, así que se puede testear sin base ni contenedor.
 *
 * El CUIT se valida ANTES que el par y con mensaje propio: sin CUIT no hay a quién
 * representar, y para una tienda secundaria apagada por fail-closed éste es el error
 * que la explica. La alternativa —dejarlo pasar y que WSAA rechace el login—
 * convierte un problema de configuración en un 424 opaco.
 */
export function toArcaConfig(settings: ArcaSettings): ArcaConfig {
  if (settings.cuitRepresentada.length !== 11) {
    throw new ArcaConfigError(
      'Falta el CUIT de Minimalart (11 dígitos) en Integraciones → Globales → ARCA / AFIP.'
    );
  }
  return {
    cuitRepresentada: settings.cuitRepresentada,
    ...materializePair(settings),
    environment: settings.environment,
    service: settings.service,
    urls: settings.urls,
  };
}

/* -------------------------------------------------------------------------- */
/* Camino SINCRÓNICO: configuración de la INSTANCIA                            */
/* -------------------------------------------------------------------------- */

/**
 * Hay con qué intentar una consulta a nivel INSTANCIA.
 *
 * Es un diagnóstico, no una guarda: dice "el backend tiene cargadas las piezas", no
 * "esta tienda puede consultar". Una tienda secundaria puede dar `true` acá y fallar
 * igual por fail-closed, que es lo correcto — la respuesta verdadera para una tienda
 * sólo la puede dar el camino async.
 */
export function isArcaConfigured(): boolean {
  const settings = getArcaSettings();
  return (
    settings.cuitRepresentada.length === 11 &&
    (Boolean(settings.certificateBase64) || Boolean(process.env.ARCA_CERTIFICATE_PATH?.trim())) &&
    (Boolean(settings.privateKeyBase64) || Boolean(process.env.ARCA_PRIVATE_KEY_PATH?.trim()))
  );
}

/** Config de la INSTANCIA. Tira `ArcaConfigError` si falta alguna pieza. */
export function getArcaConfig(): ArcaConfig {
  return toArcaConfig(getArcaSettings());
}

/* -------------------------------------------------------------------------- */
/* Camino por tienda                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Cómo se identifica la tienda. Se aceptan las dos formas porque los call sites
 * tienen datos distintos a mano: el admin tiene `site_id` (header `x-site-id`) y el
 * storefront tiene el sales channel de su publishable key. Mismo contrato que
 * `CorreoSiteHint`.
 */
export type ArcaSiteHint = {
  siteId?: string | null;
  salesChannelId?: string | null;
};

/** `PG_CONNECTION` del contenedor, o `undefined`. */
export function arcaPgFrom(container: MedusaContainer): PgRawConnection | undefined {
  try {
    return container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as unknown as PgRawConnection;
  } catch {
    return undefined;
  }
}

/** All callers use Minimalart's global CUIT lookup account. Legacy site hints
 * remain in the signature for compatibility, but never select credentials. */
export async function loadArcaConfigViaPg(
  pg: PgRawConnection | undefined,
  _hint: ArcaSiteHint | undefined | null,
  _logger: MinimalLogger
): Promise<{ config: ArcaConfig; resolution?: SiteResolution }> {
  return { config: toArcaConfig(await loadArcaSettingsViaPg(pg)) };
}

/** Atajo para los call sites que tienen el contenedor completo. */
export async function getArcaConfigForSite(
  container: MedusaContainer,
  hint: ArcaSiteHint | undefined | null,
  logger: MinimalLogger
): Promise<ArcaConfig> {
  return (await loadArcaConfigViaPg(arcaPgFrom(container), hint, logger)).config;
}

/* -------------------------------------------------------------------------- */
/* Diagnóstico para el admin                                                   */
/* -------------------------------------------------------------------------- */

/**
 * De dónde sale la identidad fiscal que se está usando.
 *
 * `undecryptable` NO es un detalle técnico que se pueda omitir de la UI: es el único
 * estado en el que la tienda parece configurada y no puede operar. Sin mostrarlo, el
 * operador se entera recién cuando falla una emisión, y el mensaje que ve es un 424
 * genérico que no apunta a las credenciales.
 */
export type ArcaCredentialsSource = 'site' | 'instance' | 'undecryptable';

/** Lo que el admin puede saber de la config de ARCA. NUNCA incluye material PEM. */
export type ArcaConfigStatus = {
  environment: ArcaEnvironment;
  service: string;
  /** `true` si hay 11 dígitos. Nunca el CUIT: alcanza para saber si falta. */
  cuit_present: boolean;
  certificate_present: boolean;
  private_key_present: boolean;
  /** El par sale de un `*_PATH` del entorno, que no se puede gestionar desde el admin. */
  uses_legacy_path: boolean;
  credentials_source: ArcaCredentialsSource;
  /** `null` = la configuración es la de la instancia, no la de una tienda. */
  site_id: string | null;
};

/**
 * Estado de la config, SIN material sensible y sin tirar.
 *
 * No reusa `toArcaConfig` porque ése corta ante la primera pieza faltante, y lo que
 * la card necesita mostrar es justamente CUÁL falta.
 *
 * Recibe los settings EFECTIVOS —o sea, ya con `site_credential` aplicado encima— y
 * no los crudos. Con los crudos, una tienda que cargó su certificado por la pantalla
 * de credenciales vería "Falta certificado" en la card mientras opera perfecto: una
 * card que miente sobre credenciales es peor que no tenerla, porque induce a cargar
 * de nuevo un secreto que ya estaba.
 *
 * Los booleanos son lo ÚNICO que sale del backend sobre un certificado. Ni siquiera
 * una "cola de cuatro" como la de los secretos de `app-settings`: el final de un PEM
 * en base64 es idéntico en todos, así que no distingue nada, y serían bytes de una
 * clave privada viajando por HTTP para nada.
 */
export function describeArcaSettings(
  settings: ArcaSettings,
  siteId: string | null = null,
  credentialsSource: ArcaCredentialsSource = 'instance'
): ArcaConfigStatus {
  const certPath = Boolean(process.env.ARCA_CERTIFICATE_PATH?.trim());
  const keyPath = Boolean(process.env.ARCA_PRIVATE_KEY_PATH?.trim());
  return {
    environment: settings.environment,
    service: settings.service,
    cuit_present: settings.cuitRepresentada.length === 11,
    certificate_present: Boolean(settings.certificateBase64) || certPath,
    private_key_present: Boolean(settings.privateKeyBase64) || keyPath,
    uses_legacy_path:
      (!settings.certificateBase64 && certPath) || (!settings.privateKeyBase64 && keyPath),
    credentials_source: credentialsSource,
    site_id: siteId,
  };
}

/** Status reports the same global account used by every lookup. */
export async function loadArcaStatusViaPg(
  pg: PgRawConnection | undefined,
  _hint: ArcaSiteHint | undefined | null
): Promise<ArcaConfigStatus> {
  return describeArcaSettings(await loadArcaSettingsViaPg(pg));
}
