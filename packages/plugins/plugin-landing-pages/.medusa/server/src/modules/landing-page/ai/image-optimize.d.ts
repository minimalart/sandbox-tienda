/**
 * Convierte una imagen (PNG/JPEG de la IA) a WebP optimizado en peso y tamaño.
 * Hero = banner ancho (1600px), ImageBlock = imagen de contenido (1200px). No se
 * fuerza alto/crop para no distorsionar lo que devuelve el modelo (que ya viene
 * con el aspect ratio pedido). Si el WebP supera `maxKb`, se reintenta UNA vez
 * bajando la calidad; si aún excede, se devuelve igual (mejor que fallar).
 *
 * Devuelve base64 CRUDO (sin prefijo data:) listo para `fileModule.createFiles`.
 */
export type SlotKind = 'hero' | 'imageBlock';
export type OptimizedImage = {
    base64: string;
    mimeType: 'image/webp';
    bytes: number;
    width: number;
    height: number;
};
export declare function optimizeToWebp(input: Buffer, kind: SlotKind, opts: {
    quality: number;
    maxKb: number;
}): Promise<OptimizedImage>;
