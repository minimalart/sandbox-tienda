"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.isUndecryptableCredentialsError = void 0;
exports.readArcaSiteCredentials = readArcaSiteCredentials;
exports.applyArcaSiteCredentials = applyArcaSiteCredentials;
/**
 * Las credenciales propias de esta tienda, o `null` si hereda las de la instancia.
 *
 * SHIM DEL PLUGIN: siempre devuelve `null`, porque el lector de `site_credential`
 * vive en el host y no está disponible acá. TODAS las tiendas heredan las
 * credenciales de instancia; la capa POR TIENDA se restaura cuando `multistore`
 * se plugin-ifique.
 */
async function readArcaSiteCredentials(_pg, _resolution) {
    return null;
}
/**
 * `true` si el error viene de un blob ilegible. En el plugin nunca ocurre —el
 * shim de arriba nunca tira— pero la función se mantiene para preservar la
 * superficie que `config.ts` importa.
 */
const isUndecryptableCredentialsError = (error) => error instanceof Error && error.message.includes('no se pueden descifrar');
exports.isUndecryptableCredentialsError = isUndecryptableCredentialsError;
/**
 * Aplica las credenciales de la tienda sobre el material ya resuelto de la
 * instancia. Pura: es el corazón testeable de la precedencia.
 */
function applyArcaSiteCredentials(base, creds) {
    return {
        ...base,
        certificateBase64: preferCredential(creds.certificateBase64, base.certificateBase64),
        privateKeyBase64: preferCredential(creds.privateKeyBase64, base.privateKeyBase64),
        cuitRepresentada: preferCredential(creds.cuitRepresentada?.replace(/\D/g, ''), base.cuitRepresentada),
    };
}
const preferCredential = (value, current) => typeof value === 'string' && value.trim() ? value.trim() : current;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2l0ZS1jcmVkZW50aWFscy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9saWIvYXJjYS9zaXRlLWNyZWRlbnRpYWxzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztHQXNCRzs7O0FBNkJILDBEQUtDO0FBY0QsNERBWUM7QUF2Q0Q7Ozs7Ozs7R0FPRztBQUNJLEtBQUssVUFBVSx1QkFBdUIsQ0FDM0MsR0FBdUIsRUFDdkIsV0FBMkI7SUFFM0IsT0FBTyxJQUFJLENBQUM7QUFDZCxDQUFDO0FBRUQ7Ozs7R0FJRztBQUNJLE1BQU0sK0JBQStCLEdBQUcsQ0FBQyxLQUFjLEVBQVcsRUFBRSxDQUN6RSxLQUFLLFlBQVksS0FBSyxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLHdCQUF3QixDQUFDLENBQUM7QUFEaEUsUUFBQSwrQkFBK0IsbUNBQ2lDO0FBRTdFOzs7R0FHRztBQUNILFNBQWdCLHdCQUF3QixDQUV0QyxJQUFPLEVBQUUsS0FBMEI7SUFDbkMsT0FBTztRQUNMLEdBQUcsSUFBSTtRQUNQLGlCQUFpQixFQUFFLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxpQkFBaUIsRUFBRSxJQUFJLENBQUMsaUJBQWlCLENBQUM7UUFDcEYsZ0JBQWdCLEVBQUUsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLGdCQUFnQixFQUFFLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQztRQUNqRixnQkFBZ0IsRUFBRSxnQkFBZ0IsQ0FDaEMsS0FBSyxDQUFDLGdCQUFnQixFQUFFLE9BQU8sQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLEVBQzFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FDdEI7S0FDRixDQUFDO0FBQ0osQ0FBQztBQUVELE1BQU0sZ0JBQWdCLEdBQUcsQ0FBQyxLQUF5QixFQUFFLE9BQWUsRUFBVSxFQUFFLENBQzlFLE9BQU8sS0FBSyxLQUFLLFFBQVEsSUFBSSxLQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDIn0=