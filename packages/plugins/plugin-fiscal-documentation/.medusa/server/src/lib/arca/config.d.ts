import type { MedusaContainer } from '@medusajs/framework/types';
import type { SiteResolution } from '../../lib/multistore/types';
import { type ArcaSettings, type PgRawConnection } from './settings';
import { type ArcaEnvironment } from './types';
/** Global Minimalart lookup account: saved instance settings, then environment,
 * then legacy PEM files. Store credentials and queried CUITs never select the
 * authentication identity. No certificate or key material is logged. */
export type ArcaConfig = {
    cuitRepresentada: string;
    certificatePem: string;
    privateKeyPem: string;
    environment: ArcaEnvironment;
    service: string;
    urls: {
        wsaa: string;
        padron: string;
    };
};
/** Lo mínimo del logger de Medusa. Evita arrastrar el tipo entero hasta acá. */
type MinimalLogger = {
    warn: (message: string) => void;
};
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
export declare function decodePemMaterial(raw: string | undefined | null, label: string, sourceName: string): string | null;
/**
 * De la configuración resuelta a la config lista para firmar. Función PURA salvo por
 * los dos paths legacy, así que se puede testear sin base ni contenedor.
 *
 * El CUIT se valida ANTES que el par y con mensaje propio: sin CUIT no hay a quién
 * representar, y para una tienda secundaria apagada por fail-closed éste es el error
 * que la explica. La alternativa —dejarlo pasar y que WSAA rechace el login—
 * convierte un problema de configuración en un 424 opaco.
 */
export declare function toArcaConfig(settings: ArcaSettings): ArcaConfig;
/**
 * Hay con qué intentar una consulta a nivel INSTANCIA.
 *
 * Es un diagnóstico, no una guarda: dice "el backend tiene cargadas las piezas", no
 * "esta tienda puede consultar". Una tienda secundaria puede dar `true` acá y fallar
 * igual por fail-closed, que es lo correcto — la respuesta verdadera para una tienda
 * sólo la puede dar el camino async.
 */
export declare function isArcaConfigured(): boolean;
/** Config de la INSTANCIA. Tira `ArcaConfigError` si falta alguna pieza. */
export declare function getArcaConfig(): ArcaConfig;
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
export declare function arcaPgFrom(container: MedusaContainer): PgRawConnection | undefined;
/** All callers use Minimalart's global CUIT lookup account. Legacy site hints
 * remain in the signature for compatibility, but never select credentials. */
export declare function loadArcaConfigViaPg(pg: PgRawConnection | undefined, _hint: ArcaSiteHint | undefined | null, _logger: MinimalLogger): Promise<{
    config: ArcaConfig;
    resolution?: SiteResolution;
}>;
/** Atajo para los call sites que tienen el contenedor completo. */
export declare function getArcaConfigForSite(container: MedusaContainer, hint: ArcaSiteHint | undefined | null, logger: MinimalLogger): Promise<ArcaConfig>;
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
export declare function describeArcaSettings(settings: ArcaSettings, siteId?: string | null, credentialsSource?: ArcaCredentialsSource): ArcaConfigStatus;
/** Status reports the same global account used by every lookup. */
export declare function loadArcaStatusViaPg(pg: PgRawConnection | undefined, _hint: ArcaSiteHint | undefined | null): Promise<ArcaConfigStatus>;
export {};
