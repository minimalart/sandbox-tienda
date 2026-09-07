export type AspectRatio = '21:9' | '16:9' | '1:1' | '4:3' | '3:4' | '9:16';
export type GeneratedImage = {
    bytes: Buffer;
    mimeType: string;
};
export declare function generateImage(opts: {
    prompt: string;
    model?: string;
    aspectRatio?: AspectRatio;
    imageSize?: '0.5K' | '1K' | '2K';
    /**
     * Imágenes de referencia (data URLs `data:image/...;base64,...`) que el modelo
     * debe usar como base. Con nano banana (Gemini 2.5 Flash Image) sirve para
     * COMPONER una escena manteniendo fieles los productos de las fotos. Se mandan
     * como partes `image_url` del mensaje (formato multimodal OpenAI-compatible).
     */
    referenceImages?: string[];
}): Promise<GeneratedImage>;
