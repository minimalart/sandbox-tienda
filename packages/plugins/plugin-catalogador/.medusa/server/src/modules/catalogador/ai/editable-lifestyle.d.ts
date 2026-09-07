import type { CatalogadorConfig } from '../config';
import { type ProcessedImage } from './images';
/**
 * Lifestyle editable (PRD §8): agregado acotado sobre el lifestyle actual que
 * permite corregir manualmente el tamaño y la posición del producto antes de
 * aplicar la imagen. NO es un motor de composición genérico (PRD §21): sólo
 *   - extrae el producto con fondo transparente (un único mecanismo: IA),
 *   - genera un fondo lifestyle SIN el producto,
 *   - compone el producto sobre el fondo con una posición/escala normalizada.
 *
 * El render final (al aplicar) reutiliza `renderEditableLifestyle`. Guardar una
 * edición NO vuelve a llamar al proveedor de IA (PRD §6.4): sólo persiste la
 * composición en `metadata`.
 */
/** Límites de escala (PRD §13): constantes, no administrables en el MVP. */
export declare const EDITABLE_MIN_SCALE = 0.08;
export declare const EDITABLE_MAX_SCALE = 0.7;
/** Composición normalizada 0-1 (PRD §8.3/§9.1). `x`/`y` = CENTRO del producto. */
export type Composition = {
    x: number;
    y: number;
    scale: number;
};
/** Metadata mínima persistida en `cataloging_asset_proposal.metadata` (PRD §9.1). */
export type EditableLifestyleMetadata = {
    version: 1;
    background: {
        url: string;
        file_id?: string;
    };
    product_layer: {
        url: string;
        file_id?: string;
        source_url: string;
    };
    /**
     * Preview inicial. Vive en su propio campo porque al aplicar
     * `generated_asset_id` pasa a apuntar al render final: sin esto, la referencia al
     * archivo del preview se pierde de la base y el binario queda huérfano en el
     * storage para siempre. Opcional para no romper las propuestas ya persistidas.
     */
    preview?: {
        url: string;
        file_id?: string;
    };
    composition: Composition;
    initial_composition: Composition;
    final_render?: {
        url: string;
        file_id?: string;
    };
};
/**
 * Composición inicial determinística (PRD §8.3): esquina inferior-derecha, que
 * es la zona que el prompt del fondo reserva libre. La escala inicial la fija
 * la config; la posición se mantiene como constante interna en el MVP.
 */
export declare const DEFAULT_EDITABLE_COMPOSITION: Composition;
/** Aplica los límites del PRD §14 (x/y ∈ [0,1], scale ∈ [MIN,MAX]). */
export declare function clampComposition(c: Partial<Composition>, defaultScale?: number): Composition;
/**
 * Extrae el producto con fondo transparente (PRD §8.1), en orden de fidelidad:
 *
 * 1. Alguna imagen del producto ya trae alpha real → recortar y reusar.
 * 2. Alguna imagen tiene fondo casi uniforme (la foto de catálogo centrada
 *    sobre blanco que todos los productos tienen) → flood-key directo, SIN
 *    llamar a IA. Es el camino más fiel: no hay recreación que pueda deformar
 *    el producto. Se prueban TODAS las candidatas en orden (la de fondo blanco
 *    puede no ser la principal).
 * 3. Fallback: recrear el producto sobre magenta sólido con el proveedor
 *    multimodal y flood-keyear ese fondo (el modelo no devuelve alpha real de
 *    forma confiable, pero sí coloca el producto sobre un color pedido).
 *
 * El flood fill sólo keyea píxeles CONECTADOS al borde: los colores parecidos
 * al fondo dentro del producto (p.ej. una pantalla rosa frente al chroma
 * magenta) no se perforan. Si nada produce un recorte utilizable, LANZA → la
 * propuesta queda en error (PRD §14).
 */
export declare function removeProductBackground(sources: Buffer[], config: CatalogadorConfig): Promise<ProcessedImage>;
/**
 * Genera un fondo lifestyle SIN el producto (PRD §8.2). Reutiliza el proveedor
 * de imágenes existente; no manda imágenes de referencia (para que el producto
 * no se cuele en la escena) y reserva la zona inferior-derecha para componerlo
 * después. No se expone como operación en la interfaz.
 */
export declare function generateLifestyleBackground(config: CatalogadorConfig, productTitle: string): Promise<ProcessedImage>;
/**
 * Compone el producto (con alpha) sobre el fondo según la composición (PRD §8.4).
 * `x`/`y` son el CENTRO del producto normalizado al fondo; `scale` = ancho del
 * producto / ancho del fondo. Soporta overflow parcial (el producto puede
 * sobresalir del borde) recortando la región visible. Exporta WebP con la
 * optimización técnica del Catalogador. No hay rotación, perspectiva ni sombras.
 */
export declare function renderEditableLifestyle(opts: {
    background: Buffer;
    product: Buffer;
    composition: Composition;
    config: CatalogadorConfig;
}): Promise<ProcessedImage>;
/**
 * Orquesta la generación editable para el pipeline (PRD §6.2): extrae el
 * producto, genera el fondo y compone un preview inicial determinístico. Cada
 * paso puede lanzar; el pipeline captura y marca la propuesta como error.
 */
export declare function buildEditableLifestyle(opts: {
    config: CatalogadorConfig;
    productTitle: string;
    /** Imágenes candidatas del producto, en orden de preferencia (principal primero). */
    references: Buffer[];
}): Promise<{
    product: ProcessedImage;
    background: ProcessedImage;
    preview: ProcessedImage;
    composition: Composition;
}>;
