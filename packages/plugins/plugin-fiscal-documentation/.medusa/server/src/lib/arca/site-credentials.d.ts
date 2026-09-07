/**
 * Credenciales de ARCA POR TIENDA — variante del plugin.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ ESTO ES UN CERTIFICADO X.509 Y SU CLAVE PRIVADA. Con ese par se firma     │
 * │ ante AFIP EN NOMBRE DE UN CUIT. Una tienda que termine usando el          │
 * │ certificado de otra opera ante el fisco como el contribuyente             │
 * │ equivocado, y eso NO SE DESHACE.                                          │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * En el HOST este archivo leía `site_credential` con SQL crudo (a través de
 * `lib/multistore/credentials.ts`, que depende de la KEK compartida en
 * `lib/shared/encryption-key.ts`). El plugin no tiene acceso a esa infra —vive
 * en `apps/backend/src/lib/`— así que este archivo se comporta como shim: nunca
 * hay credenciales por tienda, todo el mundo usa las de instancia (env).
 *
 * Cuando el reader de `site_credential` se extraiga a un paquete compartido (o
 * cuando `app-settings`/`multistore` se plugin-ifiquen), este archivo vuelve a
 * hacer el trabajo completo — inclusive el fail-loud del blob ilegible.
 *
 * REGLA DURA DEL MÓDULO, heredada de `wsaa.ts`: acá no se loguea NUNCA un PEM,
 * ni un fragmento, ni una cola de cuatro caracteres.
 */
import type { SiteResolution } from '../../lib/multistore/types';
type PgLike = {
    raw: (sql: string, bindings?: unknown[]) => Promise<{
        rows?: any[];
    }>;
};
/**
 * Lo que una tienda puede sobreescribir de la identidad fiscal de la instancia.
 *
 * Las TRES viajan juntas a propósito, aunque el CUIT no sea un secreto. El
 * certificado está EMITIDO PARA UN CUIT: cargar uno sin el otro deja el
 * certificado de un titular declarando ser otro.
 */
export type ArcaSiteCredentials = {
    /** PEM en base64, o PEM crudo. Lo normaliza `config.ts`, no este archivo. */
    certificateBase64?: string;
    privateKeyBase64?: string;
    /** Sólo dígitos. `config.ts` lo re-valida antes de usarlo. */
    cuitRepresentada?: string;
};
/**
 * Las credenciales propias de esta tienda, o `null` si hereda las de la instancia.
 *
 * SHIM DEL PLUGIN: siempre devuelve `null`, porque el lector de `site_credential`
 * vive en el host y no está disponible acá. TODAS las tiendas heredan las
 * credenciales de instancia; la capa POR TIENDA se restaura cuando `multistore`
 * se plugin-ifique.
 */
export declare function readArcaSiteCredentials(_pg: PgLike | undefined, _resolution: SiteResolution): Promise<ArcaSiteCredentials | null>;
/**
 * `true` si el error viene de un blob ilegible. En el plugin nunca ocurre —el
 * shim de arriba nunca tira— pero la función se mantiene para preservar la
 * superficie que `config.ts` importa.
 */
export declare const isUndecryptableCredentialsError: (error: unknown) => boolean;
/**
 * Aplica las credenciales de la tienda sobre el material ya resuelto de la
 * instancia. Pura: es el corazón testeable de la precedencia.
 */
export declare function applyArcaSiteCredentials<T extends {
    certificateBase64: string;
    privateKeyBase64: string;
    cuitRepresentada: string;
}>(base: T, creds: ArcaSiteCredentials): T;
export {};
