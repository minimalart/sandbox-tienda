import type { MedusaContainer } from '@medusajs/framework/types';
/**
 * Borrado de los archivos que el Catalogador generó y que ya no sirven.
 *
 * Por qué existe: el módulo era append-only. Se subía TODO antes de que el
 * operador decidiera, la decisión sólo escribía una columna `status`, y no había
 * una sola llamada a `deleteFiles` en el módulo. Cada variación no elegida, cada
 * propuesta rechazada y cada intermedio del lifestyle editable quedaban en el
 * storage para siempre, y cada regeneración multiplicaba el residuo.
 *
 * Lo que NO borra: las imágenes ORIGINALES del producto. Es política explícita
 * (`image_technical.keep_originals`, y los comentarios de `ai/images.ts` y
 * `ai/image-pipeline.ts`). Acá sólo se borra lo que el Catalogador creó.
 */
/** Un archivo subido por el Catalogador, tal como quedó referenciado. */
type AssetRef = {
    fileId: string | null;
    url: string | null;
};
/** La forma mínima de una propuesta que hace falta para saber qué borrar. */
export type CleanableProposal = {
    id: string;
    generated_asset_id?: string | null;
    operation_type?: string | null;
    metadata?: unknown;
};
/**
 * Archivos INTERMEDIOS de una propuesta: existen sólo para poder producir el
 * resultado y no se referencian nunca desde el producto.
 *
 * Hoy sólo el lifestyle editable tiene intermedios (fondo, capa de producto y
 * preview). El preview es el caso más claro de residuo del módulo: al aplicar,
 * `generated_asset_id` se sobrescribe con el render final y su URL desaparecía de
 * la base mientras el binario sobrevivía en el storage.
 */
export declare function intermediateRefs(proposal: CleanableProposal): AssetRef[];
/**
 * El archivo RESULTADO de una propuesta: lo que se adjuntaría al producto si se
 * acepta. Sólo se borra cuando la propuesta muere (rechazo, cancelación).
 */
export declare function resultRefs(proposal: CleanableProposal): AssetRef[];
/**
 * Borra los archivos de las propuestas dadas.
 *
 * `mode`:
 *  - `'discard'` — la propuesta murió (rechazada, o su ejecución se canceló/borró):
 *    se van intermedios y resultado.
 *  - `'intermediates'` — la propuesta se APLICÓ: el resultado se queda (lo
 *    referencia el producto) y sólo se van los intermedios.
 *
 * `keepUrls` protege URLs que en este momento referencia el producto. Es la red
 * de seguridad contra borrar una imagen viva: sin ella, dos propuestas que
 * apuntaran al mismo archivo podrían dejar al producto con una URL muerta.
 */
export declare function cleanupProposalFiles(container: MedusaContainer, proposals: CleanableProposal[], opts?: {
    mode: 'discard' | 'intermediates';
    keepUrls?: Iterable<string>;
}): Promise<{
    deleted: number;
}>;
/**
 * Barrido de TODOS los archivos generados por una ejecución que nunca se aplicaron.
 *
 * `cataloging_asset_proposal` no tiene `execution_id` —sólo `execution_product_id`
 * (ver `models/cataloging-asset-proposal.ts`)— así que hay que pasar por los
 * productos de la corrida. Las propuestas en `applied` se excluyen SIEMPRE: su
 * archivo lo referencia un producto vivo.
 *
 * `productIds` limita el barrido (lo usa la regeneración dirigida).
 * `deleteRows` borra además las filas: sin eso, regenerar dejaría en el tablero de
 * revisión propuestas apuntando a archivos que ya no existen.
 */
export declare function cleanupExecutionFiles(container: MedusaContainer, executionId: string, opts?: {
    productIds?: string[];
    deleteRows?: boolean;
}): Promise<{
    deleted: number;
    proposals: number;
}>;
/**
 * Borra archivos recién subidos que ya no van a referenciarse.
 *
 * Para el camino de FALLO del pipeline: los tres assets del lifestyle editable se
 * suben ANTES de crear la propuesta, así que si el tercero falla —o falla el insert
 * de la propuesta— los dos primeros quedaban en el storage y el `catch` creaba una
 * propuesta en `error` con `generated_asset_id: null`, descartando sus URLs. Nadie
 * podía volver a encontrarlos.
 */
export declare function cleanupUploadedFiles(container: MedusaContainer, uploads: Array<{
    id?: string | null;
    url?: string | null;
} | null | undefined>): Promise<{
    deleted: number;
}>;
export {};
