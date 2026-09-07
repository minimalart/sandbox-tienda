export type ChatMessage = {
    role: 'system' | 'user' | 'assistant';
    content: string;
};
/**
 * `apiKey` se devuelve como `string | undefined` y no como `''` porque
 * `isAiConfigured()` y el `if (!apiKey)` de abajo se apoyan en que sea falsy, y
 * porque es la forma pública que ya consumen `generator.ts` y `banner/ai/*`.
 */
export declare function getAiConfig(): {
    apiKey: string | undefined;
    model: string;
    maxRetries: number;
};
export declare function isAiConfigured(): boolean;
export declare function callOpenRouter(messages: ChatMessage[], opts?: {
    model?: string;
}): Promise<string>;
