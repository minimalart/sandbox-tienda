/** ARCA CUIT lookups use the global Minimalart account from the host. */
import {
  EXTERNAL_KEYS,
  getAppSettingsSyncReader,
  getExternalReader,
} from '@minimalart/mercatto-plugin-runtime';
import type { SiteResolution } from '../../lib/multistore/types';
import { ARCA_URLS, type ArcaEnvironment } from './types';

export const ARCA_SETTINGS_NAMESPACE = 'extension:fiscal-documentation';

/**
 * El entorno SEGURO. Es el piso cuando ninguna capa aportó valor. Homologación
 * a propósito: un default productivo emitiría comprobantes de verdad ante el
 * primer llamado que apunte a `wsfe`.
 */
export const SAFE_ARCA_ENVIRONMENT: ArcaEnvironment = 'homologacion';

/** El único servicio WSAA que este módulo sabe consumir. */
export const DEFAULT_WSAA_SERVICE = 'ws_sr_constancia_inscripcion';

export type ArcaSettings = {
  /** Sólo dígitos. Cadena vacía = ninguna capa lo aportó. */
  cuitRepresentada: string;
  environment: ArcaEnvironment;
  service: string;
  urls: { wsaa: string; padron: string };
  /**
   * El par, TAL COMO SE GUARDÓ: base64 o PEM crudo. Sin normalizar a propósito —
   * la normalización (y su validación) vive en `config.ts`. Cadena vacía =
   * ninguna capa lo aportó.
   */
  certificateBase64: string;
  privateKeyBase64: string;
};

/** Conexión knex mínima que necesita el camino async. Se mantiene por compatibilidad. */
export type PgRawConnection = {
  raw: (sql: string, bindings?: unknown[]) => Promise<{ rows?: unknown[] }>;
};

function readTrimmed(key: string): string {
  const raw =
    getAppSettingsSyncReader()?.('extension:fiscal-documentation', key) ?? process.env[key];
  return typeof raw === 'string' ? raw.trim() : '';
}

/**
 * Traduce lo que sea que haya en el entorno a uno de los dos entornos.
 *
 * FAIL-SAFE: cualquier cosa que no sea exactamente `production` cae en
 * homologación. Acepta `homologación` con tilde porque es como se escribe en
 * castellano.
 */
export function normalizeEnvironment(raw: string | undefined | null): ArcaEnvironment {
  const value = String(raw ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  return value === 'production' ? 'production' : SAFE_ARCA_ENVIRONMENT;
}

function buildSettings(read = readTrimmed): ArcaSettings {
  const environment = normalizeEnvironment(read('ARCA_ENVIRONMENT'));
  return {
    // Sólo dígitos, igual que hacía el loader viejo.
    cuitRepresentada: read('ARCA_CUIT_REPRESENTADA').replace(/\D/g, ''),
    environment,
    service: read('ARCA_WSAA_SERVICE') || DEFAULT_WSAA_SERVICE,
    urls: ARCA_URLS[environment],
    certificateBase64: read('ARCA_CERTIFICATE_BASE64'),
    privateKeyBase64: read('ARCA_PRIVATE_KEY_BASE64'),
  };
}

/** Instance settings for callers without a store. */
export function getArcaSettings(): ArcaSettings {
  return buildSettings();
}

type ScopedReader = (
  namespace: string,
  pg?: PgRawConnection,
  resolution?: SiteResolution
) => Promise<Record<string, unknown> | undefined>;

/** Global Minimalart account, independent of the queried company and active store. */
export async function loadArcaSettingsViaPg(
  pg: PgRawConnection | undefined,
  _resolution?: SiteResolution
): Promise<ArcaSettings> {
  const reader = getExternalReader<ScopedReader>(EXTERNAL_KEYS.APP_SETTINGS_VIA_PG)?.();
  if (!reader) return getArcaSettings();
  const values = await reader('extension:fiscal-documentation', pg);
  if (!values) return getArcaSettings();
  // Missing scoped values stay empty: do not resurrect an instance credential.
  return buildSettings((key) =>
    typeof values[key] === 'string' ? (values[key] as string).trim() : ''
  );
}
