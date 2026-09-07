/**
 * Credenciales de Correo Argentino POR TIENDA (`site_credential`).
 *
 * Vive en su propio archivo y no adentro del provider porque tiene DOS lectores
 * que no pueden compartir contenedor:
 *
 *  - `service.ts`, el provider de fulfillment, que corre en un contenedor
 *    hermético y sólo tiene `PG_CONNECTION`.
 *  - `get-client.ts`, que sirve al workflow de tickets, al job y a las rutas, y sí
 *    tiene el contenedor completo.
 *
 * Antes de esta migración el segundo NO leía nada: el workflow que CREA los envíos
 * usaba las credenciales del entorno mientras la cotización ya usaba las de la
 * tienda. Cotizar con una cuenta y despachar con otra es el bug que este archivo
 * existe para hacer imposible, así que los dos caminos pasan por acá.
 *
 * `api/admin/site-credentials/catalog.ts` apunta su `reader` a este archivo, y
 * `catalog.test.ts` cruza el literal `'correo-argentino'` de abajo contra el
 * catálogo: si dejaran de coincidir, la credencial se guardaría en una fila que
 * nadie lee y la tienda seguiría despachando con la cuenta del entorno.
 */

import { readSiteCredentialsViaSql } from '../../lib/multistore/credentials';
import type { SiteResolution } from '../../lib/multistore/types';
import type { CorreoProviderOptions } from './types';

type PgLike = { raw: (sql: string, bindings?: unknown[]) => Promise<{ rows?: any[] }> };

/**
 * Lo que una tienda puede sobreescribir de las credenciales de la instancia.
 *
 * Las claves son el CONTRATO con `catalog.ts` y con la pantalla del admin: una
 * clave de más se guarda y no se usa nunca, una de menos no se puede cargar.
 */
export type CorreoSiteCredentials = {
  micorreoUser?: string;
  micorreoPassword?: string;
  apiKey?: string;
  sellerId?: string;
  customerId?: string;
  /**
   * El acuerdo comercial. Se sumó con la migración a `app-settings`, y es la
   * clave que faltaba: viaja como header en CADA request a paqar
   * (`clients/paqar-client.ts:152`), queda estampado en `fulfillment.data` y el
   * `trackingNumber` propio se deriva de él. Sin poder cargarlo por tienda, la
   * tienda B despachaba contra el acuerdo de la A aunque tuviera su propia API
   * key — el flete se factura al CUIT equivocado y una colisión de TN dentro de
   * un acuerdo ajeno es IRRECUPERABLE.
   */
  agreement?: string;
};

const override = (value: string | undefined, current: string): string =>
  typeof value === 'string' && value.trim() ? value.trim() : current;

/**
 * Aplica las credenciales de la tienda sobre las opciones ya normalizadas.
 *
 * Existe porque el blob es PLANO (`micorreoUser`, `customerId`) y las opciones NO:
 * `CorreoProviderOptions` guarda las credenciales de MiCorreo anidadas en
 * `micorreo: { username, password, customerId }`. Un `{ ...options, ...creds }`
 * dejaba `micorreoUser` y `customerId` colgando en la raíz, donde el cliente nunca
 * los lee — así que la tienda cotizaba con el `customerId` del entorno, o sea con
 * la identidad de OTRO comerciante, en silencio. El `as never` que había en el
 * spread era justo lo que impedía que TypeScript lo marcara.
 *
 * `customerId` es el que más importa para cotizar: según `types.ts:97-103`, el
 * usuario y la contraseña de MiCorreo son por INTEGRADOR y la identidad del
 * comerciante va toda ahí. `agreement` es el que más importa para despachar.
 */
export function applyCorreoSiteCredentials(
  options: CorreoProviderOptions,
  creds: CorreoSiteCredentials,
): CorreoProviderOptions {
  const agreement = override(creds.agreement, options.agreement);
  return {
    ...options,
    apiKey: override(creds.apiKey, options.apiKey),
    agreement,
    // El `sellerId` sigue al acuerdo cuando la tienda no declara uno propio: es la
    // misma regla que `normalizeCorreoOptions` (el manual los usa de forma
    // intercambiable). Sin esto, una tienda que sólo carga su `agreement` seguiría
    // firmando los envíos con el `sellerId` derivado del acuerdo del entorno.
    sellerId: override(
      creds.sellerId,
      options.sellerId === options.agreement ? agreement : options.sellerId,
    ),
    micorreo: {
      ...options.micorreo,
      username: override(creds.micorreoUser, options.micorreo.username),
      password: override(creds.micorreoPassword, options.micorreo.password),
      customerId: override(creds.customerId, options.micorreo.customerId),
    },
  };
}

/**
 * Las credenciales propias de esta tienda, o `null` si hereda las de la instancia.
 *
 * TIRA cuando la tienda declaró las suyas y el blob no se puede descifrar
 * (típicamente porque rotó `JWT_SECRET`). No cae al entorno a propósito: cotizar y
 * despachar con la cuenta de otro titular es peor que fallar, porque el envío sale
 * igual y se le factura a quien no corresponde. Mismo criterio que
 * `lib/multistore/credentials.ts:117`.
 */
export async function readCorreoSiteCredentials(
  pg: PgLike | undefined,
  resolution: SiteResolution,
): Promise<CorreoSiteCredentials | null> {
  const creds = await readSiteCredentialsViaSql<CorreoSiteCredentials>(
    pg,
    'correo-argentino',
    resolution,
  );

  if (creds.status === 'missing' && creds.reason === 'undecryptable') {
    throw new Error(
      'Las credenciales de Correo Argentino de esta tienda no se pueden descifrar ' +
        '(probablemente rotó JWT_SECRET). Volvé a cargarlas antes de cotizar o despachar.',
    );
  }
  if (creds.status !== 'found' || creds.source !== 'site') return null;
  return creds.value;
}

/** `true` si el error viene de un blob ilegible. Los callers NO lo degradan. */
export const isUndecryptableCredentialsError = (error: unknown): boolean =>
  error instanceof Error && error.message.includes('no se pueden descifrar');
