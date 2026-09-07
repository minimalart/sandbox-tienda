/**
 * Cliente OpenRouter self-contained del Catalogador.
 *
 * Deliberadamente NO importa los clientes del Asistente IA ni de landing-page:
 * el PRD §23.1 exige que el Catalogador no quede acoplado al chat/agentes, y el
 * sistema de composición de extensiones penaliza depender de esas extensiones
 * enteras sólo para reusar un wrapper fino. Reutiliza la MISMA infra (OpenRouter,
 * `OPENROUTER_API_KEY`, nano-banana para imágenes) replicando un cliente mínimo.
 */
export declare class CatalogadorAiError extends Error {
    status: number;
    constructor(message: string, status?: number);
}
export declare function isAiConfigured(): boolean;
export type ChatUsage = {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    /**
     * Costo real cobrado por OpenRouter para esa llamada, en USD (credits).
     * Viene SIEMPRE en la respuesta: el viejo `usage: { include: true }` quedó
     * deprecado y no hace falta pedirlo.
     */
    cost?: number;
    cost_details?: {
        upstream_inference_cost?: number | null;
    } | null;
};
/**
 * Costo/consumo acumulado de un tramo de trabajo (p.ej. todas las llamadas de
 * un producto de una ejecución). Se arma con `withAiUsageTracking`, que no
 * requiere que las funciones intermedias del pipeline devuelvan el `usage`.
 */
export type AiUsageBreakdown = {
    total_usd: number;
    text_usd: number;
    image_usd: number;
    calls: number;
    prompt_tokens: number;
    completion_tokens: number;
    by_model: Record<string, {
        calls: number;
        usd: number;
    }>;
    /**
     * true si alguna respuesta no informó costo: el total es un PISO, no el
     * costo exacto (así la UI puede mostrarlo como aproximado).
     */
    missing_cost: boolean;
};
export declare function emptyAiUsage(): AiUsageBreakdown;
/** Suma dos acumulados (para agregar productos → ejecución). */
export declare function mergeAiUsage(a: AiUsageBreakdown | null | undefined, b: AiUsageBreakdown | null | undefined): AiUsageBreakdown;
/**
 * Abre un ámbito de medición: `usage` es el objeto que se va llenando con el
 * costo de TODAS las llamadas a OpenRouter que ocurran dentro de `run()`
 * (texto e imagen, a cualquier profundidad del pipeline).
 *
 * Se usa AsyncLocalStorage a propósito: el pipeline de imágenes encadena varias
 * funciones (recorte → fondo → composición) y hacer que cada una devuelva su
 * `usage` obligaría a cambiar toda la cadena de firmas.
 *
 * El llamador conserva la referencia a `usage`, así que también puede leer el
 * gasto cuando `run()` lanza: lo consumido antes del error ya se cobró.
 */
export declare function createAiUsageScope(): {
    usage: AiUsageBreakdown;
    run: <T>(fn: () => Promise<T>) => Promise<T>;
};
/** Acumulado del tramo en curso (null fuera de `withAiUsageTracking`). */
export declare function getAiUsage(): AiUsageBreakdown | null;
export type ChatMessage = {
    role: 'system' | 'assistant';
    content: string;
} | {
    role: 'user';
    content: string | Array<{
        type: 'text';
        text: string;
    } | {
        type: 'image_url';
        image_url: {
            url: string;
        };
    }>;
};
/** Una vuelta de chat-completions (texto o visión). Devuelve texto + usage. */
export declare function chatComplete(opts: {
    model: string;
    messages: ChatMessage[];
    temperature?: number;
    maxTokens?: number;
    reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high';
    jsonMode?: boolean;
}): Promise<{
    content: string;
    usage?: ChatUsage;
    finishReason?: string | null;
}>;
export type GeneratedImage = {
    bytes: Buffer;
    mimeType: string;
};
/**
 * Genera/recrea una imagen con un modelo multimodal (nano-banana / Gemini 2.5
 * Flash Image). `referenceImages` son data URLs que el modelo usa como base para
 * mantener fiel el producto (recreación/lifestyle).
 */
export declare function generateImage(opts: {
    model: string;
    prompt: string;
    referenceImages?: string[];
}): Promise<GeneratedImage>;
/**
 * Extrae un objeto JSON del texto del modelo, tolerando fences ```json y ruido.
 * Portado del tool original (robustez de parseo de salida IA).
 */
export declare function extractJson<T = unknown>(content: string): T | null;
