import { z } from 'zod';
import { findIntegration, INTEGRATION_IDS } from './catalog';

/**
 * Validación de `POST /admin/site-credentials`, en su propio módulo.
 *
 * Separado del handler por el mismo motivo que `admin/sites/schemas.ts`: los
 * `route.ts` importan `MedusaRequest`/`MedusaResponse`, que son exports SÓLO DE
 * TIPO, y bajo `node --test` importar un route.ts explota. Acá el schema se puede
 * testear sin levantar Medusa ni tocar la DB.
 */

const IntegrationId = z.enum(INTEGRATION_IDS as [string, ...string[]]);

export const UpsertSiteCredentialSchema = z
  .object({
    integration: IntegrationId,
    /**
     * Claves a guardar. Un string VACÍO significa "no toqué el campo enmascarado"
     * —lo único que la UI puede mostrar de un secreto write-only— y se ignora.
     * Para borrar está `unset`, que es explícito y por nombre.
     */
    set: z.record(z.string(), z.string()).optional(),
    /** Claves a borrar, por NOMBRE. Nunca viaja un valor de vuelta al servidor. */
    unset: z.array(z.string().min(1)).optional(),
    /**
     * Sólo si el blob guardado no se puede descifrar (rotó `JWT_SECRET`). Confirma
     * que se arranca de cero: las otras claves de esa integración se pierden porque
     * ya eran irrecuperables. Sin esto, la ruta corta con 409.
     */
    replace_undecryptable: z.boolean().optional(),
  })
  .strict()
  .superRefine((body, ctx) => {
    const spec = findIntegration(body.integration);

    // Una integración sin lector no se puede guardar. Ver el comentario de
    // `catalog.ts`: una credencial que nada consume es una pantalla que miente.
    if (spec && !spec.reader) {
      ctx.addIssue({
        code: 'custom',
        path: ['integration'],
        message:
          `'${body.integration}' todavía no lee de site_credential, así que guardar sus ` +
          `credenciales por tienda no tendría ningún efecto. ${spec.blockedReason ?? ''}`.trim(),
      });
    }

    const setKeys = Object.keys(body.set ?? {});
    const unsetKeys = body.unset ?? [];

    if (setKeys.length === 0 && unsetKeys.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['set'],
        message: 'Nada que guardar: mandá al menos una clave en `set` o en `unset`.',
      });
    }

    // Claves desconocidas en `set` se RECHAZAN: un `apikey` mal tipeado se guardaría
    // prolijo y el provider —que lee `apiKey`— nunca lo vería. El operador quedaría
    // mirando una credencial cargada que no hace nada.
    if (spec) {
      const known = new Set(spec.keys.map((entry) => entry.key));
      const unknown = setKeys.filter((key) => !known.has(key));
      if (unknown.length > 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['set'],
          message:
            `Claves desconocidas para '${body.integration}': ${unknown.join(', ')}. ` +
            `Las válidas son: ${[...known].join(', ')}.`,
        });
      }
    }
    // `unset` NO se valida contra el catálogo a propósito: es la única forma de
    // limpiar basura que quedó de un INSERT a mano, que fue el único modo de cargar
    // credenciales hasta que existió esta ruta.

    const collisions = unsetKeys.filter((key) => setKeys.includes(key));
    if (collisions.length > 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['unset'],
        message:
          `Estas claves vienen en 'set' y en 'unset' a la vez: ${collisions.join(', ')}. ` +
          `Es contradictorio y casi siempre un bug del cliente; decidí una sola.`,
      });
    }
  });

export type UpsertSiteCredentialInput = z.infer<typeof UpsertSiteCredentialSchema>;

/**
 * `DELETE /admin/site-credentials?integration=…` — desconecta la cuenta propia.
 *
 * A diferencia del POST, acá el `integration` NO se valida contra el catálogo.
 * Es deliberado: las filas huérfanas —cargadas con un INSERT a mano, o de una
 * integración que se renombró— son POR DEFINICIÓN las que el catálogo no
 * conoce, y son justo las que hay que poder limpiar. Validarlas contra el enum
 * dejaba la única vía de limpieza devolviendo 400.
 *
 * No abre un agujero: `deleteSiteCredentialsViaSql` borra por `(site_id,
 * integration)` y sólo puede tocar filas de la tienda de la request. Escribir un
 * secreto sí sigue exigiendo que la integración exista y tenga lector — guardar
 * lo que nadie consume es lo que deja una pantalla que miente.
 */
export const DeleteSiteCredentialSchema = z
  .object({ integration: z.string().min(1).max(64) })
  .strict();
