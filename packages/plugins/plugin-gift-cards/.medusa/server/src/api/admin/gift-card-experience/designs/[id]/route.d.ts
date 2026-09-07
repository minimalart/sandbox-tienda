import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import type { z } from 'zod';
import { GiftCardDesignUpdate } from '../../validators';
type Input = z.infer<typeof GiftCardDesignUpdate>;
/**
 * `assertIdInSite` y no `assertRowInSite`: ninguno de los dos handlers lee la fila antes
 * de mutarla —los dos van derecho al `update`—, así que el de fila obligaría a agregar
 * un `retrieve` sólo para tener qué chequear. Al mismo costo, el subselect reusa
 * LITERALMENTE el predicado del listado (`siteFilter` con el mismo descriptor), y por
 * construcción no puede driftear de él.
 *
 * Residual conocido, y se deja a propósito: `GIFT_CARD_DESIGN_SITE_SCOPE` declara
 * `empty: 'all'`, así que el diseño GLOBAL —hoy sólo el `brand-default` que siembra
 * `ensureDefaultDesign`— se ve desde toda tienda y por lo tanto también se puede
 * archivar desde cualquiera, y ese archivado lo saca de TODAS (el reseed chequea
 * existencia por `public_id`, no `active`, así que no lo restaura).
 *
 * La alternativa era endurecer el guard a `'unassigned'` acá nomás. Se descartó: le
 * daría a la mutación un predicado MÁS ESTRICTO que el del listado, y el modo de falla
 * de eso es un operador que ve el diseño en su pantalla y come un 404 al tocarlo, sin
 * ninguna pista de por qué. Proteger una fila sembrada de su propio borrado es un
 * problema del módulo —no tiene nada que ver con qué tienda la mira— y se arregla en el
 * servicio, no torciendo el eje de tienda hasta que tape otra cosa.
 */
export declare function POST(req: MedusaRequest<Input>, res: MedusaResponse): Promise<void>;
/** Designs are archived, never physically deleted. */
export declare function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<void>;
export {};
